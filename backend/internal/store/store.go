package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucsky/cuid"
	"golang.org/x/crypto/bcrypt"
)

var ErrNotFound = errors.New("não encontrado")

type Store struct {
	Pool *pgxpool.Pool
}

func NewID() string {
	return cuid.New()
}

func hashRefresh(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func NewRefreshToken() (raw string, hash string, err error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(b[:])
	return raw, hashRefresh(raw), nil
}

func (s *Store) CreateRefreshToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	id := NewID()
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO "GoRefreshToken" (id, "userId", "tokenHash", "expiresAt")
		VALUES ($1, $2, $3, $4)
	`, id, userID, tokenHash, expiresAt)
	return err
}

func (s *Store) DeleteRefreshByHash(ctx context.Context, tokenHash string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM "GoRefreshToken" WHERE "tokenHash" = $1`, tokenHash)
	return err
}

// ConsumeRefresh valida o token, apaga-o (rotação) e devolve o userId.
func (s *Store) ConsumeRefresh(ctx context.Context, raw string) (userID string, err error) {
	h := hashRefresh(raw)
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var uid string
	var exp time.Time
	err = tx.QueryRow(ctx, `
		SELECT "userId", "expiresAt" FROM "GoRefreshToken" WHERE "tokenHash" = $1 FOR UPDATE
	`, h).Scan(&uid, &exp)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	if time.Now().After(exp) {
		_, _ = tx.Exec(ctx, `DELETE FROM "GoRefreshToken" WHERE "tokenHash" = $1`, h)
		_ = tx.Commit(ctx)
		return "", ErrNotFound
	}
	_, err = tx.Exec(ctx, `DELETE FROM "GoRefreshToken" WHERE "tokenHash" = $1`, h)
	if err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return uid, nil
}

func (s *Store) RevokeAllRefreshForUser(ctx context.Context, userID string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM "GoRefreshToken" WHERE "userId" = $1`, userID)
	return err
}

func (s *Store) FindUserByEmail(ctx context.Context, email string) (id string, passwordHash []byte, err error) {
	err = s.Pool.QueryRow(ctx, `
		SELECT id, COALESCE(password, '') FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1
	`, strings.TrimSpace(email)).Scan(&id, &passwordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrNotFound
	}
	return id, passwordHash, err
}

func HashPassword(plain string) ([]byte, error) {
	return bcrypt.GenerateFromPassword([]byte(plain), 12)
}

func generateDisplayID() string {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}

func (s *Store) RegisterUser(ctx context.Context, name, username, email, password string) (map[string]any, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}
	displayID := generateDisplayID()
	for i := 0; i < 10; i++ {
		var cnt int
		err := s.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM "User" WHERE "displayId" = $1`, displayID).Scan(&cnt)
		if err != nil {
			return nil, err
		}
		if cnt == 0 {
			break
		}
		displayID = generateDisplayID()
	}
	id := NewID()
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO "User" (id, name, username, email, password, provider, "displayId")
		VALUES ($1, $2, $3, $4, $5, 'email', $6)
	`, id, name, strings.ToLower(strings.TrimSpace(username)), strings.TrimSpace(email), string(hash), displayID)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO "Gamification" (id, "userId") VALUES ($1, $2)
	`, NewID(), id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	var createdAt time.Time
	_ = s.Pool.QueryRow(ctx, `
		SELECT "createdAt" FROM "User" WHERE id = $1
	`, id).Scan(&createdAt)

	return map[string]any{
		"id":        id,
		"name":      name,
		"username":  strings.ToLower(username),
		"displayId": displayID,
		"email":     strings.TrimSpace(email),
		"createdAt": createdAt.UTC().Format(time.RFC3339Nano),
	}, nil
}

func (s *Store) EmailTaken(ctx context.Context, email string) (bool, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT 1 FROM "User" WHERE LOWER(email) = LOWER($1) LIMIT 1`, email).Scan(&n)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) UsernameTaken(ctx context.Context, username string) (bool, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `
		SELECT 1 FROM "User" WHERE LOWER(username) = LOWER($1) LIMIT 1
	`, username).Scan(&n)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
