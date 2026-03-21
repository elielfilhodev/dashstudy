package validate

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode"
)

var (
	cuidRe   = regexp.MustCompile(`^[a-z][a-z0-9]{20,40}$`)
	dateRe   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	timeRe   = regexp.MustCompile(`^\d{2}:\d{2}$`)
	userRe   = regexp.MustCompile(`^[a-z0-9._]{3,30}$`)
	colorRe  = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

func Email(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) > 254 {
		return false
	}
	a, err := mail.ParseAddress(s)
	return err == nil && a.Address == s
}

func CUID(s string) bool {
	return cuidRe.MatchString(strings.TrimSpace(s))
}

func DateYMD(s string) bool {
	return dateRe.MatchString(strings.TrimSpace(s))
}

func TimeHM(s string) bool {
	return timeRe.MatchString(strings.TrimSpace(s))
}

func Username(s string) bool {
	s = strings.TrimSpace(s)
	if !userRe.MatchString(s) {
		return false
	}
	return true
}

func Password(s string) bool {
	return len(s) >= 6 && len(s) <= 128
}

func Name(s string) bool {
	s = strings.TrimSpace(s)
	r := []rune(s)
	return len(r) >= 2 && len(r) <= 80
}

func HexColor(s string) bool {
	if s == "" {
		return true
	}
	return colorRe.MatchString(s)
}

func Title(s string, max int) bool {
	t := strings.TrimSpace(s)
	return len(t) >= 1 && len([]rune(t)) <= max
}

func HasLetterOrDigit(s string) bool {
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return true
		}
	}
	return false
}
