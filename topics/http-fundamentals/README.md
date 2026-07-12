# Как работает HTTP

Концептуальная база веба для джуна и начинающего веб-разработчика: что на самом деле летает между браузером и сервером. Курс разбирает протокол, а не фреймворки: структуру запроса и ответа, методы и идемпотентность, статус-коды, заголовки и content negotiation, cookies и сессии, HTTPS/TLS и кеширование. После него темы про FastAPI, Django и CORS читаются как применение уже знакомых правил, а не как магия.

## Концепты

1. **Запрос и ответ** - модель клиент-сервер, анатомия HTTP-сообщения: стартовая строка, заголовки, пустая строка, тело.
2. **Методы и идемпотентность** - GET, POST, PUT, PATCH, DELETE; безопасность, идемпотентность и почему это важно для повторов запросов.
3. **Статус-коды** - пять классов, коды, которые встречаются каждый день, и пары, которые все путают: 301/302, 401/403, 502/503.
4. **Заголовки и content negotiation** - метаданные сообщения, Content-Type против Accept, как клиент и сервер договариваются о формате, языке и сжатии.
5. **Cookies и сессии** - как stateless-протокол получает память: Set-Cookie, атрибуты безопасности, сессии на сервере против токенов.
6. **HTTPS и TLS** - что именно шифруется, как работает рукопожатие и цепочка сертификатов, что HTTPS не скрывает.
7. **Кеширование** - Cache-Control, свежесть против валидации, ETag и 304, где живут кеши по дороге от браузера до сервера.

## Предварительные требования

Нет. Достаточно уметь открывать сайты и примерно представлять, что такое браузер и сервер.

## Время прохождения

Около 1,7 часа.

## Среда выполнения

`none` - тема теоретическая, без выполнения кода. Сырые HTTP-сообщения показаны в текстовых блоках, упражнения проверяются статически.

---

## English

# How HTTP Works

The conceptual foundation of the web for junior and aspiring web developers: what actually travels between the browser and the server. The course covers the protocol, not frameworks: the structure of a request and response, methods and idempotency, status codes, headers and content negotiation, cookies and sessions, HTTPS/TLS, and caching. After it, topics like FastAPI, Django, and CORS read as applications of rules you already know, not magic.

## Concepts

1. **Request and response** - the client-server model, anatomy of an HTTP message: start line, headers, blank line, body.
2. **Methods and idempotency** - GET, POST, PUT, PATCH, DELETE; safety, idempotency, and why it matters for retrying requests.
3. **Status codes** - the five classes, the codes you see every day, and the pairs everyone confuses: 301/302, 401/403, 502/503.
4. **Headers and content negotiation** - message metadata, Content-Type vs. Accept, how client and server agree on format, language, and compression.
5. **Cookies and sessions** - how a stateless protocol gets memory: Set-Cookie, security attributes, server-side sessions vs. tokens.
6. **HTTPS and TLS** - what actually gets encrypted, how the handshake and certificate chain work, what HTTPS doesn't hide.
7. **Caching** - Cache-Control, freshness vs. validation, ETag and 304, where caches live on the way from browser to server.

## Prerequisites

None. Just being able to open websites and having a rough idea of what a browser and a server are.

Generated via `lesson-forge`.
