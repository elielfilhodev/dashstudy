package security

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	maxLoginFailures = 8
	lockoutDuration  = 15 * time.Minute
)

type lockEntry struct {
	failures    int
	lockedUntil time.Time
}

// LoginLock limita tentativas por IP+e-mail (mitigação de força bruta distribuída por conta).
type LoginLock struct {
	mu sync.Mutex
	m  map[string]*lockEntry
}

func NewLoginLock() *LoginLock {
	return &LoginLock{m: make(map[string]*lockEntry)}
}

// ClientIP melhor esforço atrás de proxy (confie apenas nos headers em infraestrutura controlada).
func ClientIP(r *http.Request) string {
	return clientIP(r)
}

func lockKey(r *http.Request, email string) string {
	ip := clientIP(r)
	return ip + "|" + strings.ToLower(strings.TrimSpace(email))
}

func (l *LoginLock) IsLocked(r *http.Request, email string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	k := lockKey(r, email)
	e := l.m[k]
	if e == nil {
		return false
	}
	if time.Now().Before(e.lockedUntil) {
		return true
	}
	if e.failures == 0 {
		delete(l.m, k)
	}
	return false
}

func (l *LoginLock) RecordFailure(r *http.Request, email string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	k := lockKey(r, email)
	e := l.m[k]
	if e == nil {
		e = &lockEntry{}
		l.m[k] = e
	}
	if time.Now().After(e.lockedUntil) {
		e.failures = 0
	}
	e.failures++
	if e.failures >= maxLoginFailures {
		e.lockedUntil = time.Now().Add(lockoutDuration)
	}
}

func (l *LoginLock) RecordSuccess(r *http.Request, email string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.m, lockKey(r, email))
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
