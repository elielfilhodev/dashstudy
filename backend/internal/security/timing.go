package security

import "golang.org/x/crypto/bcrypt"

// Hash bcrypt válido fixo (password "password") para comparação quando o utilizador não existe.
const dummyBcryptHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

func ComparePassword(hashed []byte, plain string) error {
	if len(hashed) == 0 {
		return bcrypt.CompareHashAndPassword([]byte(dummyBcryptHash), []byte(plain))
	}
	return bcrypt.CompareHashAndPassword(hashed, []byte(plain))
}
