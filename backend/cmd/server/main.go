package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dashstudy/backend/internal/auth"
	"github.com/dashstudy/backend/internal/config"
	"github.com/dashstudy/backend/internal/db"
	"github.com/dashstudy/backend/internal/httpserver"
	"github.com/dashstudy/backend/internal/security"
	"github.com/dashstudy/backend/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	st := &store.Store{Pool: pool}
	jwtSvc := auth.NewJWT(cfg)
	lock := security.NewLoginLock()
	srv := httpserver.New(cfg, log, st, jwtSvc, lock)

	addr := ":" + cfg.Port
	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 18,
	}

	go func() {
		log.Info("listening", "addr", addr, "env", cfg.Env)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	<-ch
	log.Info("shutdown")

	shutdownCtx, cancel2 := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel2()
	_ = httpSrv.Shutdown(shutdownCtx)
}
