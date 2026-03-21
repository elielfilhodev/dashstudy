package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/dashstudy/backend/internal/api"
	"github.com/dashstudy/backend/internal/auth"
	"github.com/dashstudy/backend/internal/config"
	"github.com/dashstudy/backend/internal/middleware"
	"github.com/dashstudy/backend/internal/security"
	"github.com/dashstudy/backend/internal/store"
	"github.com/dashstudy/backend/internal/validate"
	"github.com/go-chi/chi/v5"
)

type Server struct {
	cfg   *config.Config
	log   *slog.Logger
	store *store.Store
	jwt   *auth.JWT
	lock  *security.LoginLock
}

func New(cfg *config.Config, log *slog.Logger, pool *store.Store, jwt *auth.JWT, lock *security.LoginLock) *Server {
	if log == nil {
		log = slog.Default()
	}
	return &Server{cfg: cfg, log: log, store: pool, jwt: jwt, lock: lock}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer(s.log))
	r.Use(middleware.SecurityHeaders(s.cfg.IsProduction))
	if len(s.cfg.AllowedOrigins) > 0 {
		r.Use(middleware.CORS(s.cfg.AllowedOrigins))
	}
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.MaxBody(s.cfg.MaxBodyBytes))
		r.Use(middleware.RateLimit(s.cfg.RatePerMinute))

		r.Route("/auth", func(r chi.Router) {
			r.Use(middleware.RateLimit(s.cfg.AuthPerMinute))
			r.Use(middleware.RequireJSON)
			r.Post("/register", s.register)
			r.Post("/login", s.login)
			r.Post("/refresh", s.refresh)
		})

		r.Group(func(r chi.Router) {
			r.Use(middleware.BearerAuth(s.jwt))
			r.Post("/auth/logout", s.logout)
			r.Post("/presence", s.presence)

			r.Get("/subjects", s.listSubjects)
			r.With(middleware.RequireJSON).Post("/subjects", s.createSubject)
			r.With(middleware.RequireJSON).Patch("/subjects/{id}", s.patchSubject)
			r.Delete("/subjects/{id}", s.deleteSubject)

			r.Get("/tasks", s.listTasks)
			r.With(middleware.RequireJSON).Post("/tasks", s.createTask)
			r.With(middleware.RequireJSON).Patch("/tasks/{id}", s.patchTask)
			r.Delete("/tasks/{id}", s.deleteTask)

			r.Get("/goals", s.listGoals)
			r.With(middleware.RequireJSON).Post("/goals", s.createGoal)
			r.With(middleware.RequireJSON).Patch("/goals/{id}", s.patchGoal)
			r.Delete("/goals/{id}", s.deleteGoal)

			r.Get("/agenda", s.listAgenda)
			r.With(middleware.RequireJSON).Post("/agenda", s.createAgenda)
			r.With(middleware.RequireJSON).Patch("/agenda/{id}", s.patchAgenda)
			r.Delete("/agenda/{id}", s.deleteAgenda)

			r.Get("/friends", s.listFriends)
			r.With(middleware.RequireJSON).Post("/friends", s.addFriend)
			r.With(middleware.RequireJSON).Patch("/friends/{id}", s.patchFriend)
			r.Delete("/friends/{id}", s.deleteFriend)

			r.Get("/gamification", s.getGamification)
			r.With(middleware.RequireJSON).Post("/gamification", s.postGamification)
		})
	})

	return r
}

func (s *Server) uid(ctx context.Context) (string, bool) {
	return middleware.UserIDFromContext(ctx)
}

// --- auth ---

type registerBody struct {
	Name            string `json:"name"`
	Username        string `json:"username"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var b registerBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if !validate.Name(b.Name) {
		api.BadRequest(w, "Nome deve ter pelo menos 2 caracteres")
		return
	}
	if !validate.Username(b.Username) {
		api.BadRequest(w, "Username inválido")
		return
	}
	if !validate.Email(b.Email) {
		api.BadRequest(w, "E-mail inválido")
		return
	}
	if !validate.Password(b.Password) {
		api.BadRequest(w, "Senha deve ter pelo menos 6 caracteres")
		return
	}
	if b.Password != b.ConfirmPassword {
		api.BadRequest(w, "As senhas não conferem")
		return
	}
	taken, err := s.store.EmailTaken(r.Context(), b.Email)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if taken {
		api.BadRequest(w, "Já existe uma conta com este e-mail")
		return
	}
	taken, err = s.store.UsernameTaken(r.Context(), b.Username)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if taken {
		api.BadRequest(w, "Este username já está em uso")
		return
	}
	user, err := s.store.RegisterUser(r.Context(), strings.TrimSpace(b.Name), b.Username, strings.TrimSpace(b.Email), b.Password)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.Created(w, user)
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var b loginBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if !validate.Email(b.Email) || !validate.Password(b.Password) {
		api.Unauthorized(w)
		return
	}
	if s.lock.IsLocked(r, b.Email) {
		api.TooManyRequests(w)
		return
	}
	id, hash, err := s.store.FindUserByEmail(r.Context(), b.Email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			_ = security.ComparePassword(nil, b.Password)
			s.lock.RecordFailure(r, b.Email)
			api.Unauthorized(w)
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if err := security.ComparePassword(hash, b.Password); err != nil {
		s.lock.RecordFailure(r, b.Email)
		api.Unauthorized(w)
		return
	}
	s.lock.RecordSuccess(r, b.Email)
	access, err := s.jwt.IssueAccess(id)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	raw, h, err := store.NewRefreshToken()
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	exp := time.Now().Add(s.cfg.RefreshTTL)
	if err := s.store.CreateRefreshToken(r.Context(), id, h, exp); err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, map[string]any{
		"access_token":  access,
		"refresh_token": raw,
		"expires_in":    int(s.cfg.AccessTTL.Seconds()),
		"token_type":    "Bearer",
	})
}

type refreshBody struct {
	RefreshToken string `json:"refresh_token"`
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	var b refreshBody
	if err := api.DecodeJSON(r, &b); err != nil || strings.TrimSpace(b.RefreshToken) == "" {
		api.Unauthorized(w)
		return
	}
	uid, err := s.store.ConsumeRefresh(r.Context(), b.RefreshToken)
	if err != nil {
		api.Unauthorized(w)
		return
	}
	access, err := s.jwt.IssueAccess(uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	raw, h, err := store.NewRefreshToken()
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	exp := time.Now().Add(s.cfg.RefreshTTL)
	if err := s.store.CreateRefreshToken(r.Context(), uid, h, exp); err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, map[string]any{
		"access_token":  access,
		"refresh_token": raw,
		"expires_in":    int(s.cfg.AccessTTL.Seconds()),
		"token_type":    "Bearer",
	})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	if err := s.store.RevokeAllRefreshForUser(r.Context(), uid); err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, map[string]any{"ok": true})
}

func (s *Server) presence(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	if err := s.store.TouchPresence(r.Context(), uid); err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, map[string]any{"ok": true})
}

