package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) ListSubjects(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, "userId", name, workload, progress, color, "createdAt", "updatedAt"
		FROM "Subject"
		WHERE "userId" = $1
		ORDER BY "createdAt" ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id, uid, name, color string
		var workload, progress int
		var createdAt, updatedAt interface{}
		if err := rows.Scan(&id, &uid, &name, &workload, &progress, &color, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id": id, "userId": uid, "name": name, "workload": workload, "progress": progress, "color": color,
			"createdAt": createdAt, "updatedAt": updatedAt,
		})
	}
	return out, rows.Err()
}

func (s *Store) CreateSubject(ctx context.Context, userID, name string, workload int, color string) (map[string]any, error) {
	id := NewID()
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "Subject" (id, "userId", name, workload, color)
		VALUES ($1, $2, $3, $4, $5)
	`, id, userID, name, workload, color)
	if err != nil {
		return nil, err
	}
	return s.getSubject(ctx, id)
}

func (s *Store) getSubject(ctx context.Context, id string) (map[string]any, error) {
	var rid, uid, name, color string
	var workload, progress int
	var createdAt, updatedAt interface{}
	err := s.Pool.QueryRow(ctx, `
		SELECT id, "userId", name, workload, progress, color, "createdAt", "updatedAt"
		FROM "Subject" WHERE id = $1
	`, id).Scan(&rid, &uid, &name, &workload, &progress, &color, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": rid, "userId": uid, "name": name, "workload": workload, "progress": progress, "color": color,
		"createdAt": createdAt, "updatedAt": updatedAt,
	}, nil
}

func (s *Store) GetSubjectOwner(ctx context.Context, id string) (userID string, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT "userId" FROM "Subject" WHERE id = $1`, id).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return userID, err
}

func (s *Store) UpdateSubjectProgress(ctx context.Context, id string, progress int) (map[string]any, error) {
	_, err := s.Pool.Exec(ctx, `UPDATE "Subject" SET progress = $2, "updatedAt" = now() WHERE id = $1`, id, progress)
	if err != nil {
		return nil, err
	}
	return s.getSubject(ctx, id)
}

func (s *Store) DeleteSubject(ctx context.Context, id string) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM "Subject" WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
