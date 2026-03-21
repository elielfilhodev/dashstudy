package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env             string
	Port            string
	DatabaseURL     string
	JWTSecret       string
	AllowedOrigins  []string
	AccessTTL       time.Duration
	RefreshTTL      time.Duration
	IsProduction    bool
	MaxBodyBytes    int64
	RatePerMinute   int
	AuthPerMinute   int
}

func Load() (*Config, error) {
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL é obrigatório")
	}

	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if len(secret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET deve ter pelo menos 32 caracteres")
	}

	env := strings.TrimSpace(os.Getenv("ENV"))
	if env == "" {
		env = "development"
	}

	origins := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	var allowed []string
	if origins != "" {
		for _, o := range strings.Split(origins, ",") {
			if t := strings.TrimSpace(o); t != "" {
				allowed = append(allowed, t)
			}
		}
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}

	accessMin := 15
	if v := os.Getenv("JWT_ACCESS_MINUTES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 24*60 {
			accessMin = n
		}
	}
	refreshDays := 7
	if v := os.Getenv("JWT_REFRESH_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 90 {
			refreshDays = n
		}
	}

	maxBody := int64(512 * 1024)
	if v := os.Getenv("MAX_BODY_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 1024 && n <= 10*1024*1024 {
			maxBody = n
		}
	}

	rate := 120
	if v := os.Getenv("RATE_LIMIT_PER_MINUTE"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			rate = n
		}
	}
	authRate := 20
	if v := os.Getenv("AUTH_RATE_LIMIT_PER_MINUTE"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			authRate = n
		}
	}

	return &Config{
		Env:            env,
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      secret,
		AllowedOrigins: allowed,
		AccessTTL:      time.Duration(accessMin) * time.Minute,
		RefreshTTL:     time.Duration(refreshDays) * 24 * time.Hour,
		IsProduction:   env == "production",
		MaxBodyBytes:   maxBody,
		RatePerMinute:  rate,
		AuthPerMinute:  authRate,
	}, nil
}
