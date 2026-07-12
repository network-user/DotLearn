# Django REST Framework: сериализаторы, ViewSet, аутентификация

Голый Django умеет отдавать HTML, но собирать JSON-API руками - это бесконечные `JsonResponse`, ручной разбор тела и валидация в каждой view. Django REST Framework снимает эту рутину: сериализаторы превращают модели в JSON и обратно с проверкой данных, generic views и `ModelViewSet` дают готовый CRUD из трёх строк, роутер сам разводит URL, а классы аутентификации и прав отвечают на вопросы «кто запрос» и «что ему можно».

Пять разделов проходят путь от первого `APIView` до боевого endpoint со списком: `Request`/`Response` и content negotiation; `Serializer` против `ModelSerializer`, валидация и `save`; миксины, `ViewSet` и `DefaultRouter`; конвейер authentication -> permission и разница между 401 и 403; пагинация, фильтрация, throttling и версионирование. Каждая идея сопровождается схемой, а упражнения моделируют логику DRF на чистом Python - без запуска фреймворка.

Предполагается, что Вы уже знакомы с моделями и view Django. После этого топика Вы сможете спроектировать REST-API, который читается по сигнатурам, а не по комментариям.

---

## English

# Django REST Framework: Serializers, ViewSets, Authentication

Plain Django can serve HTML, but building a JSON API by hand means endless `JsonResponse` calls, manual body parsing, and validation duplicated in every view. Django REST Framework removes that routine: serializers turn models into JSON and back with built-in validation, generic views and `ModelViewSet` give you a full CRUD in three lines, the router wires up URLs on its own, and authentication and permission classes answer "who is this request" and "what are they allowed to do".

Six sections walk the path from the first `APIView` to a production-ready list endpoint: `Request`/`Response` and content negotiation; `Serializer` vs `ModelSerializer`, validation and `save`; mixins, `ViewSet` and `DefaultRouter`; the authentication -> permission pipeline and the difference between 401 and 403; pagination, filtering, throttling and versioning; and query optimization with `select_related`/`prefetch_related`. Each idea comes with a diagram, and the exercises model DRF's logic in plain Python without running the framework. After this topic you'll be able to design a REST API that reads clearly from its signatures rather than its comments.

## Concepts

1. Why DRF on top of Django: APIView, Request, Response
2. Serializers: object vs JSON, validation, save
3. Generic views, ViewSets and routers
4. Authentication and permissions: who can do what
5. Pagination, filtering, throttling, versioning
6. Query optimization: N+1 in serializers, select_related and prefetch_related

## Prerequisites

Topic [django](../django): you need to already know Django models and views before building serializers and endpoints on top of them.

Generated via `lesson-forge`.
