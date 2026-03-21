package store

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	xpBase       = 20
	xpWeekBonus  = 100
	xpMonthBonus = 300
	daysInWeek   = 7
	daysInMonth  = 30
)

func LevelFromXp(xp int) map[string]any {
	level := 1
	threshold := 100
	accumulated := 0
	for xp >= accumulated+threshold {
		accumulated += threshold
		level++
		threshold = int(math.Round(float64(threshold) * 1.25))
	}
	return map[string]any{
		"level":       level,
		"currentXp":   xp - accumulated,
		"nextLevelXp": threshold,
		"totalXp":     xp,
	}
}

func (s *Store) ensureGamification(ctx context.Context, userID string) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "Gamification" (id, "userId") VALUES ($1, $2)
		ON CONFLICT ("userId") DO NOTHING
	`, NewID(), userID)
	return err
}

func intSliceToAny(s []int) []any {
	if len(s) == 0 {
		return []any{}
	}
	o := make([]any, len(s))
	for i, v := range s {
		o[i] = v
	}
	return o
}

func parseIntJSON(b []byte) ([]int, error) {
	if len(b) == 0 || string(b) == "null" {
		return nil, nil
	}
	var out []int
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// intArraySQL produz literal int[] apenas com inteiros internos (sem dados de utilizador).
func intArraySQL(a []int) string {
	if len(a) == 0 {
		return "ARRAY[]::int[]"
	}
	parts := make([]string, len(a))
	for i, v := range a {
		parts[i] = strconv.Itoa(v)
	}
	return "ARRAY[" + strings.Join(parts, ",") + "]::int[]"
}

func (s *Store) GetGamification(ctx context.Context, userID string) (map[string]any, error) {
	if err := s.ensureGamification(ctx, userID); err != nil {
		return nil, err
	}

	var id string
	var xp, totalCompletions, streakDays, bestStreak int
	var last *string
	var wJSON, mJSON []byte
	var updatedAt interface{}

	err := s.Pool.QueryRow(ctx, `
		SELECT id, xp, "totalCompletions", "streakDays", "bestStreak", "lastCompletionDate",
		       COALESCE(to_json("weeklyMilestones"), '[]'::json)::text,
		       COALESCE(to_json("monthlyMilestones"), '[]'::json)::text,
		       "updatedAt"
		FROM "Gamification" WHERE "userId" = $1
	`, userID).Scan(&id, &xp, &totalCompletions, &streakDays, &bestStreak, &last, &wJSON, &mJSON, &updatedAt)
	if err != nil {
		return nil, err
	}
	weekly, err := parseIntJSON(wJSON)
	if err != nil {
		return nil, err
	}
	monthly, err := parseIntJSON(mJSON)
	if err != nil {
		return nil, err
	}

	achRows, err := s.Pool.Query(ctx, `
		SELECT id, "key", "unlockedAt" FROM "Achievement" WHERE "gamificationId" = $1 ORDER BY "unlockedAt" ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer achRows.Close()
	var achievements []map[string]any
	for achRows.Next() {
		var aid, key, unlocked string
		if err := achRows.Scan(&aid, &key, &unlocked); err != nil {
			return nil, err
		}
		achievements = append(achievements, map[string]any{"id": aid, "key": key, "unlockedAt": unlocked})
	}
	if err := achRows.Err(); err != nil {
		return nil, err
	}

	return map[string]any{
		"id":                 id,
		"userId":             userID,
		"xp":                 xp,
		"totalCompletions":   totalCompletions,
		"streakDays":         streakDays,
		"bestStreak":         bestStreak,
		"lastCompletionDate": last,
		"weeklyMilestones":   intSliceToAny(weekly),
		"monthlyMilestones":  intSliceToAny(monthly),
		"updatedAt":          updatedAt,
		"achievements":       achievements,
		"levelInfo":          LevelFromXp(xp),
	}, nil
}

func (s *Store) CompleteTaskGamification(ctx context.Context, userID, taskID string) (map[string]any, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var tUser string
	var tDone bool
	err = tx.QueryRow(ctx, `SELECT "userId", done FROM "Task" WHERE id = $1 FOR UPDATE`, taskID).Scan(&tUser, &tDone)
	if errors.Is(err, pgx.ErrNoRows) {
		return map[string]any{"skipped": true}, nil
	}
	if err != nil {
		return nil, err
	}
	if tUser != userID || tDone {
		return map[string]any{"skipped": true}, nil
	}

	var gid string
	var gXp, gTotal, gStreak, gBest int
	var gLast *string
	var wJSON, mJSON []byte

	err = tx.QueryRow(ctx, `
		SELECT id, xp, "totalCompletions", "streakDays", "bestStreak", "lastCompletionDate",
		       COALESCE(to_json("weeklyMilestones"), '[]'::json)::text,
		       COALESCE(to_json("monthlyMilestones"), '[]'::json)::text
		FROM "Gamification" WHERE "userId" = $1 FOR UPDATE
	`, userID).Scan(&gid, &gXp, &gTotal, &gStreak, &gBest, &gLast, &wJSON, &mJSON)

	var gWeekly, gMonthly []int
	if errors.Is(err, pgx.ErrNoRows) {
		gid = NewID()
		if _, err := tx.Exec(ctx, `INSERT INTO "Gamification" (id, "userId") VALUES ($1, $2)`, gid, userID); err != nil {
			return nil, err
		}
		gWeekly, gMonthly = nil, nil
		gXp, gTotal, gStreak, gBest = 0, 0, 0, 0
		gLast = nil
	} else if err != nil {
		return nil, err
	} else {
		gWeekly, err = parseIntJSON(wJSON)
		if err != nil {
			return nil, err
		}
		gMonthly, err = parseIntJSON(mJSON)
		if err != nil {
			return nil, err
		}
	}

	todayKey := time.Now().UTC().Format("2006-01-02")
	var dayDiff *int
	if gLast != nil && *gLast != "" {
		t0, e0 := time.Parse("2006-01-02", *gLast)
		t1, e1 := time.Parse("2006-01-02", todayKey)
		if e0 == nil && e1 == nil {
			d := int(t1.Sub(t0).Hours() / 24)
			dayDiff = &d
		}
	}

	newStreak := gStreak
	if dayDiff == nil || *dayDiff > 1 {
		newStreak = 1
	} else if *dayDiff == 1 {
		newStreak = gStreak + 1
	}

	bestStreak := gBest
	if newStreak > bestStreak {
		bestStreak = newStreak
	}

	earned := xpBase
	weekly := append([]int(nil), gWeekly...)
	monthly := append([]int(nil), gMonthly...)

	if newStreak%daysInWeek == 0 && !slices.Contains(weekly, newStreak) {
		earned += xpWeekBonus
		weekly = append(weekly, newStreak)
	}
	if newStreak%daysInMonth == 0 && !slices.Contains(monthly, newStreak) {
		earned += xpMonthBonus
		monthly = append(monthly, newStreak)
	}

	newXp := gXp + earned
	newTotal := gTotal + 1
	oldLevel := LevelFromXp(gXp)
	newLevel := LevelFromXp(newXp)

	unlock := func(key string) {
		_, _ = tx.Exec(ctx, `
			INSERT INTO "Achievement" (id, "gamificationId", "key", "unlockedAt")
			VALUES ($1, $2, $3, $4)
			ON CONFLICT ("gamificationId", "key") DO NOTHING
		`, NewID(), gid, key, todayKey)
	}

	if newTotal == 1 {
		unlock("FIRST_TASK")
	}
	if newTotal == 10 {
		unlock("TEN_TASKS")
	}
	if newTotal == 50 {
		unlock("FIFTY_TASKS")
	}
	if newTotal == 100 {
		unlock("HUNDRED_TASKS")
	}
	if newStreak >= 7 {
		unlock("WEEK_STREAK")
	}
	if newStreak >= 30 {
		unlock("MONTH_STREAK")
	}

	q := `
		UPDATE "Gamification" SET
			xp = $2,
			"totalCompletions" = $3,
			"streakDays" = $4,
			"bestStreak" = $5,
			"lastCompletionDate" = $6,
			"weeklyMilestones" = ` + intArraySQL(weekly) + `,
			"monthlyMilestones" = ` + intArraySQL(monthly) + `,
			"updatedAt" = now()
		WHERE "userId" = $1`
	_, err = tx.Exec(ctx, q, userID, newXp, newTotal, newStreak, bestStreak, todayKey)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	full, err := s.GetGamification(ctx, userID)
	if err != nil {
		return nil, err
	}

	full["reward"] = map[string]any{
		"xpEarned":   earned,
		"leveledUp":  newLevel["level"].(int) > oldLevel["level"].(int),
		"newLevel":   newLevel["level"],
		"streakDays": newStreak,
	}
	return full, nil
}
