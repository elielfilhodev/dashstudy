package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *Store) ListAgenda(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT a.id, a."userId", a."subjectId", a.title, a.date, a.time, a.location, a.done, a."createdAt", a."updatedAt",
		       s.id, s.name
		FROM "AgendaItem" a
		LEFT JOIN "Subject" s ON s.id = a."subjectId"
		WHERE a."userId" = $1
		ORDER BY a.date ASC, a.time ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var rid, uid, title, date, tm, loc string
		var subjectID *string
		var done bool
		var createdAt, updatedAt interface{}
		var sid *string
		var sname *string
		if err := rows.Scan(&rid, &uid, &subjectID, &title, &date, &tm, &loc, &done, &createdAt, &updatedAt, &sid, &sname); err != nil {
			return nil, err
		}
		row := map[string]any{
			"id": rid, "userId": uid, "subjectId": subjectID, "title": title, "date": date, "time": tm,
			"location": loc, "done": done, "createdAt": createdAt, "updatedAt": updatedAt,
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

func (s *Store) CreateAgenda(ctx context.Context, userID, title, date, tm, location string, subjectID *string) (map[string]any, error) {
	id := NewID()
	if location == "" {
		location = "Nao definido"
	}
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "AgendaItem" (id, "userId", "subjectId", title, date, time, location)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, userID, subjectID, title, date, tm, location)
	if err != nil {
		return nil, err
	}
	return s.getAgenda(ctx, id)
}

func (s *Store) getAgenda(ctx context.Context, id string) (map[string]any, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT a.id, a."userId", a."subjectId", a.title, a.date, a.time, a.location, a.done, a."createdAt", a."updatedAt",
		       s.id, s.name
		FROM "AgendaItem" a
		LEFT JOIN "Subject" s ON s.id = a."subjectId"
		WHERE a.id = $1
	`, id)
	var rid, uid, title, date, tm, loc string
	var subjectID *string
	var done bool
	var createdAt, updatedAt interface{}
	var sid *string
	var sname *string
	err := row.Scan(&rid, &uid, &subjectID, &title, &date, &tm, &loc, &done, &createdAt, &updatedAt, &sid, &sname)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	out := map[string]any{
		"id": rid, "userId": uid, "subjectId": subjectID, "title": title, "date": date, "time": tm,
		"location": loc, "done": done, "createdAt": createdAt, "updatedAt": updatedAt,
	}
	if sid != nil && sname != nil {
		out["subject"] = map[string]any{"id": *sid, "name": *sname}
	} else {
		out["subject"] = nil
	}
	return out, nil
}

func (s *Store) GetAgendaOwner(ctx context.Context, id string) (string, error) {
	var uid string
	err := s.Pool.QueryRow(ctx, `SELECT "userId" FROM "AgendaItem" WHERE id = $1`, id).Scan(&uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return uid, err
}

func (s *Store) GetAgendaForUser(ctx context.Context, id, userID string) (title, date, tm, loc string, done bool, subjectID *string, err error) {
	err = s.Pool.QueryRow(ctx, `
		SELECT title, date, time, location, done, "subjectId" FROM "AgendaItem" WHERE id = $1 AND "userId" = $2
	`, id, userID).Scan(&title, &date, &tm, &loc, &done, &subjectID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", "", false, nil, ErrNotFound
	}
	return title, date, tm, loc, done, subjectID, err
}

func (s *Store) UpdateAgendaFull(ctx context.Context, id, title, date, tm, loc string, done bool, subjectID *string) (map[string]any, error) {
	_, err := s.Pool.Exec(ctx, `
		UPDATE "AgendaItem" SET title = $2, date = $3, time = $4, location = $5, done = $6, "subjectId" = $7, "updatedAt" = now()
		WHERE id = $1
	`, id, title, date, tm, loc, done, subjectID)
	if err != nil {
		return nil, err
	}
	return s.getAgenda(ctx, id)
}

func (s *Store) DeleteAgenda(ctx context.Context, id string) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM "AgendaItem" WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
