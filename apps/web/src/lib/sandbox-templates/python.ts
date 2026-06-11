export interface PythonTemplate {
  id: string;
  labelKey: string;
  descriptionKey: string;
  code: string;
}

const HELLO_CODE = `print("Привет, мир")

имя = "Анна"
print(f"Здравствуй, {имя}!")

for слово in ["раз", "два", "три"]:
    print(слово)
`;

const LISTS_CODE = `города = ["Москва", "Казань", "Сочи", "Пермь", "Уфа"]

print("Первый город:", города[0])
print("Последний город:", города[-1])
print("Первые три:", города[:3])
print("Каждый второй:", города[::2])
print("В обратном порядке:", города[::-1])

длинные = [город for город in города if len(город) > 4]
print("Длинные названия:", длинные)
`;

const DATACLASS_CODE = `from dataclasses import dataclass


@dataclass
class Книга:
    название: str
    автор: str
    год: int

    def описание(self) -> str:
        return f"«{self.название}» — {self.автор}, {self.год}"


книги = [
    Книга("Мастер и Маргарита", "Михаил Булгаков", 1967),
    Книга("Вишнёвый сад", "Антон Чехов", 1904),
    Книга("Отцы и дети", "Иван Тургенев", 1862),
]

for книга in sorted(книги, key=lambda к: к.год):
    print(книга.описание())
`;

const JSON_CODE = `import json

заказ = {
    "клиент": "Пётр Смирнов",
    "город": "Санкт-Петербург",
    "товары": [
        {"название": "Кофемолка", "цена": 3490},
        {"название": "Термокружка", "цена": 990},
    ],
}

текст = json.dumps(заказ, ensure_ascii=False, indent=2)
print(текст)

снова = json.loads(текст)
итого = sum(т["цена"] for т in снова["товары"])
print("Сумма заказа:", итого)
`;

const REGEX_CODE = `import re

текст = "Заказы: №1024 от Анны, №1090 от Петра, №1130 от Марии"

номера = re.findall(r"№(\\d+)", текст)
print("Номера заказов:", номера)

имена = re.findall(r"от (\\w+)", текст)
print("Имена клиентов:", имена)

замена = re.sub(r"№\\d+", "[скрыто]", текст)
print("После маскировки:", замена)
`;

const BLANK_CODE = `print("Песочница готова")

# напиши здесь свой код на Python
`;

export const pythonTemplates: PythonTemplate[] = [
  {
    id: 'hello',
    labelKey: 'python.templates.hello.label',
    descriptionKey: 'python.templates.hello.description',
    code: HELLO_CODE,
  },
  {
    id: 'lists',
    labelKey: 'python.templates.lists.label',
    descriptionKey: 'python.templates.lists.description',
    code: LISTS_CODE,
  },
  {
    id: 'dataclass',
    labelKey: 'python.templates.dataclass.label',
    descriptionKey: 'python.templates.dataclass.description',
    code: DATACLASS_CODE,
  },
  {
    id: 'json',
    labelKey: 'python.templates.json.label',
    descriptionKey: 'python.templates.json.description',
    code: JSON_CODE,
  },
  {
    id: 'regex',
    labelKey: 'python.templates.regex.label',
    descriptionKey: 'python.templates.regex.description',
    code: REGEX_CODE,
  },
  {
    id: 'blank',
    labelKey: 'python.templates.blank.label',
    descriptionKey: 'python.templates.blank.description',
    code: BLANK_CODE,
  },
];

export const pythonTemplateById = (id: string): PythonTemplate | undefined =>
  pythonTemplates.find((template) => template.id === id);

export const defaultPythonTemplate: PythonTemplate = pythonTemplates[0] as PythonTemplate;
