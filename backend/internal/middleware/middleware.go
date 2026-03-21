package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/dashstudy/backend/internal/api"
	"github.com/dashstudy/backend/internal/auth"
	"github.com/dashstudy/backend/internal/security"
	"github.com/go-chi/chi/v5/middleware"
	"golang.org/x/time/rate"
)

type ctxKey string

const UserIDKey ctxKey = "userID"

func RequestID(next http.Handler) http.Handler {
	return middleware.RequestID(next)
}

func RealIP(next http.Handler) http.Handler {
	return middleware.RealIP(next)
}

func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					if log != nil {
						log.Error("panic recovered", "recover", rec)
					}
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(`{"error":"Erro interno do servidor"}`))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func MaxBody(max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil && r.ContentLength > max {
				api.BadRequest(w, "Corpo da requisição muito grande")
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, max)
			next.ServeHTTP(w, r)
		})
	}
}

func SecurityHeaders(isProd bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Resource-Policy", "same-site")
			if isProd {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}

func CORS(allowed []string) func(http.Handler) http.Handler {
	allowMap := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		allowMap[strings.TrimSpace(o)] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowMap[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Vary", "Origin")
				}
				reqHdr := r.Header.Get("Access-Control-Request-Headers")
				if reqHdr != "" {
					w.Header().Set("Access-Control-Allow-Headers", reqHdr)
				} else {
					w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
				}
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

var limiterMu sync.Mutex
var limiters = make(map[string]*rate.Limiter)

func RateLimit(perMinute int) func(http.Handler) http.Handler {
	if perMinute <= 0 {
		perMinute = 60
	}
	burst := perMinute
	if burst > 300 {
		burst = 300
	}
	every := rate.Every(time.Minute / time.Duration(perMinute))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := security.ClientIP(r)
			limiterMu.Lock()
			lim, ok := limiters[ip]
			if !ok {
				lim = rate.NewLimiter(every, burst)
				limiters[ip] = lim
			}
			limiterMu.Unlock()
			if !lim.Allow() {
				api.TooManyRequests(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPatch {
			ct := r.Header.Get("Content-Type")
			if ct == "" || !strings.HasPrefix(strings.ToLower(strings.TrimSpace(ct)), "application/json") {
				api.BadRequest(w, "Content-Type deve ser application/json")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func BearerAuth(j *auth.JWT) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			const p = "Bearer "
			if len(h) < len(p) || !strings.EqualFold(h[:len(p)], p) {
				api.Unauthorized(w)
				return
			}
			raw := strings.TrimSpace(h[len(p):])
			if raw == "" {
				api.Unauthorized(w)
				return
			}
			uid, err := j.ParseAccess(raw)
			if err != nil {
				api.Unauthorized(w)
				return
			}
			ctx := contextWithUserID(r.Context(), uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func contextWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(UserIDKey)
	if v == nil {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}
