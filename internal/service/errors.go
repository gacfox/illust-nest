package service

type ValidationError struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
}

func (e *ValidationError) Error() string {
	return e.Message
}
