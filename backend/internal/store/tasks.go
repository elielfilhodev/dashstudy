package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) ListTasks(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT t.id, t."userId", t."subjectId", t.title, t.details, t."dueDate", t.done, t."createdAt", t."updatedAt",
		       s.id, s.name
		FROM "Task" t
		LEFT JOIN "Subject" s ON s.id = t."subjectId"
		WHERE t."userId" = $1
		ORDER BY t."dueDate" ASC, t."createdAt" ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var rid, uid, title, details, due string
		var subjectID *string
		var done bool
		var createdAt, updatedAt interface{}
		var sid *string
		var sname *string
		if err := rows.Scan(&rid, &uid, &subjectID, &title, &details, &due, &done, &createdAt, &updatedAt, &sid, &sname); err != nil {
			return nil, err
		}
		row := map[string]any{
			"id": rid, "userId": uid, "subjectId": subjectID, "title": title, "details": details,
			"dueDate": due, "done": done, "createdAt": createdAt, "updatedAt": updatedAt,
		}
		if sid != nil && sname != nil {
			row["subject"] = map[string]any{"id": *sid, "name": *sname}
		} else {
			row["subject"] = nil
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *Store) CreateTask(ctx context.Context, userID, title, details, dueDate string, subjectID *string) (map[string]any, error) {
	id := NewID()
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "Task" (id, "userId", "subjectId", title, details, "dueDate")
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, userID, subjectID, title, details, dueDate)
	if err != nil {
		return nil, err
	}
	return s.getTask(ctx, id)
}

func (s *Store) getTask(ctx context.Context, id string) (map[string]any, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT t.id, t."userId", t."subjectId", t.title, t.details, t."dueDate", t.done, t."createdAt", t."updatedAt",
		       s.id, s.name
		FROM "Task" t
		LEFT JOIN "Subject" s ON s.id = t."subjectId"
		WHERE t.id = $1
	`, id)
	var rid, uid, title, details, due string
	var subjectID *string
	var done bool
	var createdAt, updatedAt interface{}
	var sid *string
	var sname *string
	err := row.Scan(&rid, &uid, &subjectID, &title, &details, &due, &done, &createdAt, &updatedAt, &sid, &sname)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	out := map[string]any{
		"id": rid, "userId": uid, "subjectId": subjectID, "title": title, "details": details,
		"dueDate": due, "done": done, "createdAt": createdAt, "updatedAt": updatedAt,
	}
	if sid != nil && sname != nil {
		out["subject"] = map[string]any{"id": *sid, "name": *sname}
	} else {
		out["subject"] = nil
	}
	return out, nil
}

func (s *Store) GetTaskOwner(ctx context.Context, id string) (userID string, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT "userId" FROM "Task" WHERE id = $1`, id).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return userID, err
}

func (s *Store) GetTaskForUser(ctx context.Context, id, userID string) (title, details, dueDate string, done bool, subjectID *string, err error) {
	err = s.Pool.QueryRow(ctx, `
		SELECT title, details, "dueDate", done, "subjectId" FROM "Task" WHERE id = $1 AND "userId" = $2
	`, id, userID).Scan(&title, &details, &dueDate, &done, &subjectID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", false, nil, ErrNotFound
	}
	return title, details, dueDate, done, subjectID, err
}

func (s *Store) UpdateTaskFull(ctx context.Context, id, title, details, dueDate string, done bool, subjectID *string) (map[string]any, error) {
	_, err := s.Pool.Exec(ctx, `
		UPDATE "Task" SET title = $2, details = $3, "dueDate" = $4, done = $5, "subjectId" = $6, "updatedAt" = now()
		WHERE id = $1
	`, id, title, details, dueDate, done, subjectID)
	if err != nil {
		return nil, err
	}
	return s.getTask(ctx, id)
}

func (s *Store) DeleteTask(ctx context.Context, id string) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM "Task" WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) GetTaskMinimal(ctx context.Context, id string) (userID string, done bool, err error) {
	err = s.Pool.QueryRow(ctx, `SELECT "userId", done FROM "Task" WHERE id = $1`, id).Scan(&userID, &done)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, ErrNotFound
	}
	return userID, done, err
}
