package store

import "context"

func (s *Store) TouchPresence(ctx context.Context, userID string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE "User" SET "lastSeenAt" = now(), "updatedAt" = now() WHERE id = $1`, userID)
	return err
}
