# Django: модели, ORM, views, формы и admin

Django - это «батарейки в комплекте» для веб-разработки на Python: от описания данных классом-моделью до готовой админки за пять минут. Топик проводит через паттерн MTV и путь запроса, через ORM с его ленивыми QuerySet и ловушкой N+1, через маршрутизацию URL и два стиля views, через язык шаблонов и валидацию форм, и заканчивается встроенной аутентификацией и admin-сайтом. К концу Вы понимаете, какой код Django выполняет за Вас и где это понимание спасает от тихих багов - исчезнувших запросов, лишних SQL-обращений и форм, которые «не сохраняются».

---

## English

# Django: Models, ORM, Views, Forms and Admin

Django ships batteries included for Python web development: from a model class describing your data to a working admin site in five minutes. This topic walks through the MTV pattern and the request lifecycle, the ORM with its lazy QuerySets and the N+1 trap, URL routing and both styles of views, the template language and form validation, and finishes with built-in authentication and the admin site. By the end you understand what code Django runs on your behalf, and that understanding is what saves you from silent bugs: queries that never fire, extra SQL round-trips, and forms that quietly refuse to save.

## Concepts

1. Django architecture: MTV and the request path
2. Models and the ORM: QuerySets, relations, N+1
3. Views and URLconf: routing the request
4. Templates and forms: rendering and validation
5. Admin and authentication: users and permissions

## Prerequisites

Topics [python-oop](../python-oop) and [sql-fundamentals](../sql-fundamentals): you need classes and objects, plus basic SQL (SELECT, JOIN, primary/foreign keys), to follow the ORM and admin sections comfortably.

Generated via `lesson-forge`.
