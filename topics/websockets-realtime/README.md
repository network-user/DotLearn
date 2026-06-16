# WebSocket и Socket.IO

Разбор того, как браузер и сервер держат постоянное двунаправленное соединение поверх одного TCP: апгрейд из HTTP в WebSocket, формат фреймов, жизненный цикл соединения в браузерном API, надстройка Socket.IO с её комнатами и автопереподключением, а также серверные паттерны realtime - broadcast, presence и горизонтальное масштабирование. Тема для тех, кто пишет чаты, нотификации, живые дашборды и совместное редактирование и хочет понимать, что происходит под капотом, а не только дёргать `socket.emit`.

Концепты:

1. От HTTP к WebSocket: handshake и фреймы
2. WebSocket API и жизненный цикл соединения
3. Socket.IO: надстройка над WebSocket
4. Паттерны: broadcast, presence, масштабирование

Prerequisites: нет.

Generated via `lesson-forge`.

## English

# WebSocket and Socket.IO

How the browser and server keep a persistent two-way connection over a single TCP link: upgrading from HTTP to WebSocket, frame format, connection lifecycle in the browser API, the Socket.IO layer with its rooms and auto-reconnect, and server-side realtime patterns - broadcast, presence, and horizontal scaling. For anyone building chats, notifications, live dashboards, or collaborative editing who wants to understand what happens under the hood, not just call `socket.emit`.

## Concepts

1. From HTTP to WebSocket: handshake and frames
2. WebSocket API and connection lifecycle
3. Socket.IO: a layer on top of WebSocket
4. Patterns: broadcast, presence, scaling

## Prerequisites

None.

Generated via `lesson-forge`.
