package store

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const onlineThreshold = 5 * time.Minute

func isOnline(lastSeen *time.Time) bool {
	if lastSeen == nil {
		return false
	}
	return time.Since(*lastSeen) < onlineThreshold
}

func (s *Store) FindUserByUsername(ctx context.Context, username string, excludeUserID string) (map[string]string, error) {
	var id, name, uname, displayID, image *string
	err := s.Pool.QueryRow(ctx, `
		SELECT id, name, username, "displayId", image
		FROM "User"
		WHERE LOWER(username) = LOWER($1) AND id <> $2
		LIMIT 1
	`, strings.TrimSpace(username), excludeUserID).Scan(&id, &name, &uname, &displayID, &image)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	out := map[string]string{
		"id":        deref(id),
		"name":      deref(name),
		"username":  deref(uname),
		"displayId": deref(displayID),
		"image":     deref(image),
	}
	return out, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func (s *Store) GetFriendshipBetween(ctx context.Context, a, b string) (id string, status string, err error) {
	err = s.Pool.QueryRow(ctx, `
		SELECT id, status::text FROM "Friendship"
		WHERE ("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $2 AND "receiverId" = $1)
		LIMIT 1
	`, a, b).Scan(&id, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	return id, status, err
}

func (s *Store) CreateFriendship(ctx context.Context, senderID, receiverID string) (string, error) {
	id := NewID()
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "Friendship" (id, "senderId", "receiverId", status)
		VALUES ($1, $2, $3, 'PENDING'::"FriendshipStatus")
	`, id, senderID, receiverID)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *Store) GetFriendship(ctx context.Context, id string) (senderID, receiverID, status string, err error) {
	err = s.Pool.QueryRow(ctx, `
		SELECT "senderId", "receiverId", status::text FROM "Friendship" WHERE id = $1
	`, id).Scan(&senderID, &receiverID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", ErrNotFound
	}
	return senderID, receiverID, status, err
}

func (s *Store) AcceptFriendship(ctx context.Context, id string) (map[string]any, error) {
	_, err := s.Pool.Exec(ctx, `
		UPDATE "Friendship" SET status = 'ACCEPTED'::"FriendshipStatus", "updatedAt" = now() WHERE id = $1
	`, id)
	if err != nil {
		return nil, err
	}
	var fid, senderID, receiverID string
	var status string
	var createdAt, updatedAt interface{}
	err = s.Pool.QueryRow(ctx, `
		SELECT id, "senderId", "receiverId", status::text, "createdAt", "updatedAt" FROM "Friendship" WHERE id = $1
	`, id).Scan(&fid, &senderID, &receiverID, &status, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": fid, "senderId": senderID, "receiverId": receiverID, "status": status,
		"createdAt": createdAt, "updatedAt": updatedAt,
	}, nil
}

func (s *Store) BlockFriendship(ctx context.Context, id string) (map[string]any, error) {
	_, err := s.Pool.Exec(ctx, `
		UPDATE "Friendship" SET status = 'BLOCKED'::"FriendshipStatus", "updatedAt" = now() WHERE id = $1
	`, id)
	if err != nil {
		return nil, err
	}
	var fid, senderID, receiverID string
	var status string
	var createdAt, updatedAt interface{}
	err = s.Pool.QueryRow(ctx, `
		SELECT id, "senderId", "receiverId", status::text, "createdAt", "updatedAt" FROM "Friendship" WHERE id = $1
	`, id).Scan(&fid, &senderID, &receiverID, &status, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": fid, "senderId": senderID, "receiverId": receiverID, "status": status,
		"createdAt": createdAt, "updatedAt": updatedAt,
	}, nil
}

func (s *Store) DeleteFriendship(ctx context.Context, id string) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM "Friendship" WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListFriendsBundle(ctx context.Context, userID string) (map[string]any, error) {
	type row struct {
		FID      string
		Status   string
		Sender   bool
		UID      string
		Name     *string
		Username *string
		Display  string
		Image    *string
		LastSeen *time.Time
		XP       int
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT f.id, f.status::text, true AS is_sender,
		       u.id, u.name, u.username, u."displayId", u.image, u."lastSeenAt", COALESCE(g.xp, 0)
		FROM "Friendship" f
		JOIN "User" u ON u.id = f."receiverId"
		LEFT JOIN "Gamification" g ON g."userId" = u.id
		WHERE f."senderId" = $1
		UNION ALL
		SELECT f.id, f.status::text, false AS is_sender,
		       u.id, u.name, u.username, u."displayId", u.image, u."lastSeenAt", COALESCE(g.xp, 0)
		FROM "Friendship" f
		JOIN "User" u ON u.id = f."senderId"
		LEFT JOIN "Gamification" g ON g."userId" = u.id
		WHERE f."receiverId" = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var friends, pendingReceived, pendingSent []map[string]any

	for rows.Next() {
		var r row
		if err := rows.Scan(&r.FID, &r.Status, &r.Sender, &r.UID, &r.Name, &r.Username, &r.Display, &r.Image, &r.LastSeen, &r.XP); err != nil {
			return nil, err
		}
		xp := r.XP
		name := "Usuário"
		if r.Name != nil && *r.Name != "" {
			name = *r.Name
		}
		item := map[string]any{
			"id":          r.UID,
			"name":        name,
			"username":    r.Username,
			"displayId":   r.Display,
			"image":       r.Image,
			"online":      isOnline(r.LastSeen),
			"lastSeenAt":  nil,
			"xp":          xp,
			"friendshipId": r.FID,
		}
		if r.LastSeen != nil {
			item["lastSeenAt"] = r.LastSeen.UTC().Format(time.RFC3339Nano)
		}
		if r.Status == "ACCEPTED" {
			dir := "sent"
			if !r.Sender {
				dir = "received"
			}
			item["direction"] = dir
			friends = append(friends, item)
		} else if r.Status == "PENDING" {
			if r.Sender {
				item["direction"] = "sent"
				pendingSent = append(pendingSent, item)
			} else {
				item["direction"] = "received"
				pendingReceived = append(pendingReceived, item)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Slice(friends, func(i, j int) bool {
		oi, _ := friends[i]["online"].(bool)
		oj, _ := friends[j]["online"].(bool)
		return oi && !oj
	})

	return map[string]any{
		"friends":          friends,
		"pendingReceived": pendingReceived,
		"pendingSent":     pendingSent,
	}, nil
}
