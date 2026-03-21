package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/dashstudy/backend/internal/config"
)

type envelope struct {
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if data == nil && status == http.StatusNoContent {
		return
	}
	_ = json.NewEncoder(w).Encode(data)
}

func OK(w http.ResponseWriter, data any) {
	WriteJSON(w, http.StatusOK, envelope{Data: data})
}

func Created(w http.ResponseWriter, data any) {
	WriteJSON(w, http.StatusCreated, envelope{Data: data})
}

func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func BadRequest(w http.ResponseWriter, msg string) {
	WriteJSON(w, http.StatusBadRequest, envelope{Error: msg})
}

func Unauthorized(w http.ResponseWriter) {
	WriteJSON(w, http.StatusUnauthorized, envelope{Error: "Não autenticado"})
}

func Forbidden(w http.ResponseWriter) {
	WriteJSON(w, http.StatusForbidden, envelope{Error: "Acesso negado"})
}

func NotFound(w http.ResponseWriter, entity string) {
	WriteJSON(w, http.StatusNotFound, envelope{Error: entity + " não encontrado"})
}

func TooManyRequests(w http.ResponseWriter) {
	WriteJSON(w, http.StatusTooManyRequests, envelope{Error: "Muitas requisições. Tente novamente em instantes."})
}

func ServerError(cfg *config.Config, w http.ResponseWriter, err error, log *slog.Logger) {
	if log != nil {
		log.Error("server error", "err", err)
	}
	msg := "Erro interno do servidor"
	if !cfg.IsProduction && err != nil {
		msg = err.Error()
	}
	WriteJSON(w, http.StatusInternalServerError, envelope{Error: msg})
}

func DecodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
