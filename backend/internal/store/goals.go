package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) ListGoals(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, "userId", title, target, done, "createdAt", "updatedAt"
		FROM "Goal" WHERE "userId" = $1 ORDER BY "createdAt" ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var rid, uid, title string
		var target, done int
		var createdAt, updatedAt interface{}
		if err := rows.Scan(&rid, &uid, &title, &target, &done, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": rid, "userId": uid, "title": title, "target": target, "done": done,
			"createdAt": createdAt, "updatedAt": updatedAt,
		})
	}
	return out, rows.Err()
}

func (s *Store) CreateGoal(ctx context.Context, userID, title string, target int) (map[string]any, error) {
	id := NewID()
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "Goal" (id, "userId", title, target) VALUES ($1, $2, $3, $4)
	`, id, userID, title, target)
	if err != nil {
		return nil, err
	}
	return s.getGoal(ctx, id)
}

func (s *Store) getGoal(ctx context.Context, id string) (map[string]any, error) {
	var rid, uid, title string
	var target, done int
	var createdAt, updatedAt interface{}
	err := s.Pool.QueryRow(ctx, `
		SELECT id, "userId", title, target, done, "createdAt", "updatedAt" FROM "Goal" WHERE id = $1
	`, id).Scan(&rid, &uid, &title, &target, &done, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": rid, "userId": uid, "title": title, "target": target, "done": done,
		"createdAt": createdAt, "updatedAt": updatedAt,
	}, nil
}

func (s *Store) GetGoalOwner(ctx context.Context, id string) (string, error) {
	var uid string
	err := s.Pool.QueryRow(ctx, `SELECT "userId" FROM "Goal" WHERE id = $1`, id).Scan(&uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return uid, err
}

func (s *Store) GetGoalDone(ctx context.Context, id, userID string) (done int, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT done FROM "Goal" WHERE id = $1 AND "userId" = $2`, id, userID).Scan(&done)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	return done, err
}

func (s *Store) UpdateGoalDone(ctx context.Context, id string, done int) (map[string]any, error) {
	_, err := s.Pool.Exec(ctx, `UPDATE "Goal" SET done = $2, "updatedAt" = now() WHERE id = $1`, id, done)
	if err != nil {
		return nil, err
	}
	return s.getGoal(ctx, id)
}

func (s *Store) DeleteGoal(ctx context.Context, id string) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM "Goal" WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
