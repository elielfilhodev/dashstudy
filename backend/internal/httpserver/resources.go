package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/dashstudy/backend/internal/api"
	"github.com/dashstudy/backend/internal/store"
	"github.com/dashstudy/backend/internal/validate"
	"github.com/go-chi/chi/v5"
)

// --- subjects ---

func (s *Server) listSubjects(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	list, err := s.store.ListSubjects(r.Context(), uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, list)
}

type createSubjectBody struct {
	Name     string `json:"name"`
	Workload int    `json:"workload"`
	Color    string `json:"color"`
}

func (s *Server) createSubject(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	var b createSubjectBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if !validate.Title(b.Name, 120) || b.Workload <= 0 {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	color := strings.TrimSpace(b.Color)
	if color == "" {
		color = "#18181b"
	}
	if !validate.HexColor(color) {
		api.BadRequest(w, "Cor inválida")
		return
	}
	row, err := s.store.CreateSubject(r.Context(), uid, strings.TrimSpace(b.Name), b.Workload, color)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.Created(w, row)
}

type patchSubjectBody struct {
	Progress int `json:"progress"`
}

func (s *Server) patchSubject(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	var b patchSubjectBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if b.Progress < 0 || b.Progress > 100 {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	owner, err := s.store.GetSubjectOwner(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Matéria")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if owner != uid {
		api.Forbidden(w)
		return
	}
	row, err := s.store.UpdateSubjectProgress(r.Context(), id, b.Progress)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, row)
}

func (s *Server) deleteSubject(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	owner, err := s.store.GetSubjectOwner(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Matéria")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if owner != uid {
		api.Forbidden(w)
		return
	}
	if err := s.store.DeleteSubject(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Matéria")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.NoContent(w)
}

// --- tasks ---

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	list, err := s.store.ListTasks(r.Context(), uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, list)
}

type createTaskBody struct {
	Title     string  `json:"title"`
	Details   string  `json:"details"`
	DueDate   string  `json:"dueDate"`
	SubjectID *string `json:"subjectId"`
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	var b createTaskBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if !validate.Title(b.Title, 200) || !validate.DateYMD(b.DueDate) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	if len([]rune(b.Details)) > 2000 {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	if b.SubjectID != nil && *b.SubjectID != "" && !validate.CUID(*b.SubjectID) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	var subj *string
	if b.SubjectID != nil && *b.SubjectID != "" {
		subj = b.SubjectID
	}
	row, err := s.store.CreateTask(r.Context(), uid, strings.TrimSpace(b.Title), b.Details, strings.TrimSpace(b.DueDate), subj)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.Created(w, row)
}

func (s *Server) patchTask(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	title, details, due, done, subj, err := s.store.GetTaskForUser(r.Context(), id, uid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Tarefa")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	raw := map[string]json.RawMessage{}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if v, ok := raw["title"]; ok {
		if err := json.Unmarshal(v, &title); err != nil || !validate.Title(title, 200) {
			api.BadRequest(w, "Dados inválidos")
			return
		}
		title = strings.TrimSpace(title)
	}
	if v, ok := raw["details"]; ok {
		if err := json.Unmarshal(v, &details); err != nil || len([]rune(details)) > 2000 {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["dueDate"]; ok {
		if err := json.Unmarshal(v, &due); err != nil || !validate.DateYMD(due) {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["done"]; ok {
		if err := json.Unmarshal(v, &done); err != nil {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["subjectId"]; ok {
		if string(v) == "null" {
			subj = nil
		} else {
			var sid string
			if err := json.Unmarshal(v, &sid); err != nil {
				api.BadRequest(w, "Dados inválidos")
				return
			}
			if sid == "" {
				subj = nil
			} else if !validate.CUID(sid) {
				api.BadRequest(w, "Dados inválidos")
				return
			} else {
				subj = &sid
			}
		}
	}
	row, err := s.store.UpdateTaskFull(r.Context(), id, title, details, due, done, subj)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, row)
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	owner, err := s.store.GetTaskOwner(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Tarefa")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if owner != uid {
		api.Forbidden(w)
		return
	}
	if err := s.store.DeleteTask(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Tarefa")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.NoContent(w)
}

// --- goals ---

func (s *Server) listGoals(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	list, err := s.store.ListGoals(r.Context(), uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, list)
}

type createGoalBody struct {
	Title  string `json:"title"`
	Target int    `json:"target"`
}

func (s *Server) createGoal(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	var b createGoalBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if !validate.Title(b.Title, 200) || b.Target <= 0 {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	row, err := s.store.CreateGoal(r.Context(), uid, strings.TrimSpace(b.Title), b.Target)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.Created(w, row)
}

type patchGoalBody struct {
	Done int `json:"done"`
}

func (s *Server) patchGoal(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	var b patchGoalBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if b.Done < 0 {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	owner, err := s.store.GetGoalOwner(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Meta")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if owner != uid {
		api.Forbidden(w)
		return
	}
	row, err := s.store.UpdateGoalDone(r.Context(), id, b.Done)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, row)
}

func (s *Server) deleteGoal(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	owner, err := s.store.GetGoalOwner(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Meta")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if owner != uid {
		api.Forbidden(w)
		return
	}
	if err := s.store.DeleteGoal(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Meta")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.NoContent(w)
}

// --- agenda ---

func (s *Server) listAgenda(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	list, err := s.store.ListAgenda(r.Context(), uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, list)
}

type createAgendaBody struct {
	Title     string  `json:"title"`
	Date      string  `json:"date"`
	Time      string  `json:"time"`
	Location  string  `json:"location"`
	SubjectID *string `json:"subjectId"`
}

func (s *Server) createAgenda(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	var b createAgendaBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if !validate.Title(b.Title, 200) || !validate.DateYMD(b.Date) || !validate.TimeHM(b.Time) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	loc := strings.TrimSpace(b.Location)
	if loc == "" {
		loc = "Nao definido"
	}
	if len([]rune(loc)) > 200 {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	if b.SubjectID != nil && *b.SubjectID != "" && !validate.CUID(*b.SubjectID) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	var subj *string
	if b.SubjectID != nil && *b.SubjectID != "" {
		subj = b.SubjectID
	}
	row, err := s.store.CreateAgenda(r.Context(), uid, strings.TrimSpace(b.Title), b.Date, b.Time, loc, subj)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.Created(w, row)
}

func (s *Server) patchAgenda(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	title, date, tm, loc, done, subj, err := s.store.GetAgendaForUser(r.Context(), id, uid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Item de agenda")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	raw := map[string]json.RawMessage{}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		api.BadRequest(w, "JSON inválido")
		return
	}
	if v, ok := raw["title"]; ok {
		if err := json.Unmarshal(v, &title); err != nil || !validate.Title(title, 200) {
			api.BadRequest(w, "Dados inválidos")
			return
		}
		title = strings.TrimSpace(title)
	}
	if v, ok := raw["date"]; ok {
		if err := json.Unmarshal(v, &date); err != nil || !validate.DateYMD(date) {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["time"]; ok {
		if err := json.Unmarshal(v, &tm); err != nil || !validate.TimeHM(tm) {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["location"]; ok {
		if err := json.Unmarshal(v, &loc); err != nil || len([]rune(loc)) > 200 {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["done"]; ok {
		if err := json.Unmarshal(v, &done); err != nil {
			api.BadRequest(w, "Dados inválidos")
			return
		}
	}
	if v, ok := raw["subjectId"]; ok {
		if string(v) == "null" {
			subj = nil
		} else {
			var sid string
			if err := json.Unmarshal(v, &sid); err != nil {
				api.BadRequest(w, "Dados inválidos")
				return
			}
			if sid == "" {
				subj = nil
			} else if !validate.CUID(sid) {
				api.BadRequest(w, "Dados inválidos")
				return
			} else {
				subj = &sid
			}
		}
	}
	row, err := s.store.UpdateAgendaFull(r.Context(), id, title, date, tm, loc, done, subj)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, row)
}

func (s *Server) deleteAgenda(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	owner, err := s.store.GetAgendaOwner(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Item de agenda")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if owner != uid {
		api.Forbidden(w)
		return
	}
	if err := s.store.DeleteAgenda(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Item de agenda")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.NoContent(w)
}

// --- friends ---

func (s *Server) listFriends(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	bundle, err := s.store.ListFriendsBundle(r.Context(), uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, bundle)
}

type addFriendBody struct {
	Username string `json:"username"`
}

func (s *Server) addFriend(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	var b addFriendBody
	if err := api.DecodeJSON(r, &b); err != nil || strings.TrimSpace(b.Username) == "" {
		api.BadRequest(w, "Username inválido")
		return
	}
	target, err := s.store.FindUserByUsername(r.Context(), b.Username, uid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.BadRequest(w, "Usuário não encontrado")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	_, st, err := s.store.GetFriendshipBetween(r.Context(), uid, target["id"])
	if err == nil {
		switch st {
		case "ACCEPTED":
			api.BadRequest(w, "Vocês já são amigos")
			return
		case "PENDING":
			api.BadRequest(w, "Solicitação já enviada")
			return
		default:
			api.BadRequest(w, "Não foi possível enviar solicitação")
			return
		}
	}
	if !errors.Is(err, store.ErrNotFound) {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	frid, err := s.store.CreateFriendship(r.Context(), uid, target["id"])
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, map[string]any{
		"friendship": map[string]any{"id": frid},
		"target":     target,
	})
}

type patchFriendBody struct {
	Action string `json:"action"`
}

func (s *Server) patchFriend(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	var b patchFriendBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.BadRequest(w, "Ação inválida")
		return
	}
	sender, receiver, _, err := s.store.GetFriendship(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Solicitação")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if sender != uid && receiver != uid {
		api.Forbidden(w)
		return
	}
	switch b.Action {
	case "accept":
		if receiver != uid {
			api.Forbidden(w)
			return
		}
		row, err := s.store.AcceptFriendship(r.Context(), id)
		if err != nil {
			api.ServerError(s.cfg, w, err, s.log)
			return
		}
		api.OK(w, row)
	case "reject":
		if err := s.store.DeleteFriendship(r.Context(), id); err != nil {
			api.ServerError(s.cfg, w, err, s.log)
			return
		}
		api.NoContent(w)
	case "block":
		row, err := s.store.BlockFriendship(r.Context(), id)
		if err != nil {
			api.ServerError(s.cfg, w, err, s.log)
			return
		}
		api.OK(w, row)
	default:
		api.BadRequest(w, "Ação inválida")
	}
}

func (s *Server) deleteFriend(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")
	if !validate.CUID(id) {
		api.BadRequest(w, "Dados inválidos")
		return
	}
	sender, receiver, _, err := s.store.GetFriendship(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Amizade")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	if sender != uid && receiver != uid {
		api.Forbidden(w)
		return
	}
	if err := s.store.DeleteFriendship(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			api.NotFound(w, "Amizade")
			return
		}
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.NoContent(w)
}

// --- gamification ---

func (s *Server) getGamification(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	row, err := s.store.GetGamification(r.Context(), uid)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, row)
}

type gamPostBody struct {
	TaskID string `json:"taskId"`
}

func (s *Server) postGamification(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.uid(r.Context())
	if !ok {
		api.Unauthorized(w)
		return
	}
	var b gamPostBody
	if err := api.DecodeJSON(r, &b); err != nil {
		api.OK(w, map[string]any{"skipped": true})
		return
	}
	if !validate.CUID(b.TaskID) {
		api.OK(w, map[string]any{"skipped": true})
		return
	}
	row, err := s.store.CompleteTaskGamification(r.Context(), uid, b.TaskID)
	if err != nil {
		api.ServerError(s.cfg, w, err, s.log)
		return
	}
	api.OK(w, row)
}
