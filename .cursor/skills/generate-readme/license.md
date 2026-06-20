# Лицензия - строгий All Rights Reserved

По умолчанию DotCore-проект **проприетарный**: все права на код принадлежат автору, любое использование, кроме просмотра для ознакомления, запрещено. Скилл всегда создаёт файл `LICENSE` и футер `## Лицензия` в README.

Это **не** open-source. Не предлагай MIT/Apache/GPL по умолчанию. Сменить лицензию - только по явному запросу пользователя.

## Что делает скилл

1. Создаёт/перезаписывает корневой `LICENSE` шаблоном ниже.
2. Добавляет футер `## Лицензия` последней секцией README (после `## Архитектура`).
3. Если в репо была другая лицензия (MIT и т.п.) - заменяет её и упоминания в README; при наличии CHANGELOG добавляет запись о смене.

## Подстановки

- `{year}` - текущий год (из даты сессии, не выдумывай).
- `{author}` - правообладатель: бренд/имя автора из репо (`LICENSE`, `package.json` author, git user). Для DotCore по умолчанию `DotCore`. Не подставляй чужие имена.

## Шаблон `LICENSE`

```text
Copyright (c) {year} {author}. All Rights Reserved.

This software and its source code are proprietary and confidential.
No permission is granted to any person to use, copy, modify, merge,
publish, distribute, sublicense, or sell any part of the Software.

The source is provided for viewing and reference only. Any other use
requires the prior written permission of the copyright holder.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHOR OR COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Футер `## Лицензия` в README

Последняя секция, после `## Архитектура`. Кратко, на русском, со ссылкой на файл:

```markdown
## Лицензия

© {year} {author}. Все права защищены.

Проприетарный код. Использование, копирование, изменение и распространение запрещены без письменного разрешения автора. Исходный код открыт только для ознакомления. См. [LICENSE](LICENSE).
```

## Если пользователь хочет иначе

Только по явному запросу. Варианты, которые можно предложить, если спросят:

| Запрос                  | Действие                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| «разреши личный запуск» | Добавь строку «Personal, non-commercial viewing and local execution are permitted.» |
| «сделай open-source»    | Спроси конкретную лицензию (MIT/Apache-2.0/...), поставь её текст                   |
| «убери LICENSE»         | Удаляй только с подтверждения пользователя                                          |

## Чеклист

- [ ] `LICENSE` создан/обновлён строгим шаблоном; `{year}` и `{author}` подставлены из репо.
- [ ] Футер `## Лицензия` - последняя секция README, со ссылкой на `LICENSE`.
- [ ] Прежняя лицензия (если была) заменена и в `LICENSE`, и в упоминаниях README.
- [ ] Open-source лицензия по умолчанию не предлагалась.
