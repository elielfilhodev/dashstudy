package auth

import (
	"errors"
	"time"

	"github.com/dashstudy/backend/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("token inválido")

type Claims struct {
	Type string `json:"typ"`
	jwt.RegisteredClaims
}

type JWT struct {
	secret    []byte
	accessTTL time.Duration
}

func NewJWT(cfg *config.Config) *JWT {
	return &JWT{
		secret:    []byte(cfg.JWTSecret),
		accessTTL: cfg.AccessTTL,
	}
}

func (j *JWT) IssueAccess(userID string) (string, error) {
	now := time.Now()
	claims := Claims{
		Type: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.accessTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(j.secret)
}

func (j *JWT) ParseAccess(tokenStr string) (userID string, err error) {
	claims, err := j.parse(tokenStr)
	if err != nil {
		return "", err
	}
	if claims.Type != "" && claims.Type != "access" {
		return "", ErrInvalidToken
	}
	if claims.Subject == "" {
		return "", ErrInvalidToken
	}
	return claims.Subject, nil
}

func (j *JWT) parse(tokenStr string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, ErrInvalidToken
		}
		return j.secret, nil
	})
	if err != nil || !t.Valid {
		return nil, ErrInvalidToken
	}
	claims, ok := t.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
