# CORS и same-origin policy

Разбор того, почему браузер блокирует запрос с одного сайта на API другого и как сервер это разрешает. Для тех, кто пишет фронтенд или бэкенд и впервые упёрся в ошибку «blocked by CORS policy»: что такое origin и same-origin policy, чем простой запрос отличается от preflight, какие заголовки `Access-Control-*` за что отвечают, как работают credentials и как читать ошибку в консоли вместо того, чтобы наугад менять конфиг.

## Концепты

1. Same-origin policy: что и зачем (`same-origin-policy`)
2. Простые запросы и preflight (`simple-vs-preflight`)
3. Заголовки, credentials и отладка ошибок (`headers-credentials-debug`)

## Prerequisites

Нет.

Generated via `lesson-forge`.
