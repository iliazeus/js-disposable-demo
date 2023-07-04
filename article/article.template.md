# Явное управление ресурсами: пробуем новую фичу JavaScript и TypeScript

Одной из самых интересных грядущих новинок JavaScript и TypeScript для меня является [явное управление ресурсами]. Новый синтаксис `using foobar = ...` реализует идиому [RAII], позволяя писать намного менее многословный код, управляющий какими-либо ресурсами.

[явное управление ресурсами]: https://github.com/tc39/proposal-explicit-resource-management
[raii]: https://ru.wikipedia.org/wiki/Получение_ресурса_есть_инициализация

В этой статье я хочу на примерах разобрать эту фичу — в том виде, в котором она сейчас доступна в [TypeScript 5.2.0-beta] с полифиллом [disposablestack]. Я рассмотрю синхронные и асинхронные ресурсы, `DisposableStack`/`AsyncDisposableStack`, а также приведу пример неочевидного бага, в который попался я сам. По пути я также коснусь нескольких других нововведений Node.js, про которые, возможно, еще знают не все.

[typescript 5.2.0-beta]: https://devblogs.microsoft.com/typescript/announcing-typescript-5-2-beta/#using-declarations-and-explicit-resource-management
[disposablestack]: https://www.npmjs.com/package/disposablestack

Весь код доступен [в репозитории].

[в репозитории]: https://github.com/iliazeus/js-disposable-demo

## Что нам понадобится для новых фич

Я буду использовать довольно новую версию Node.js:

```bash
$ node --version
$(node --version)
```

Но все фичи, которые я буду использовать, доступны и в последней LTS-версии Node 18.16.1.

Нам понадобится установить бета-версию TypeScript, а также полифиллы для библиотечной части пропозала:

```bash
$ npm i -D typescript@5.2-beta @types/node@18
$ npm i disposablestack
```

<details><summary>Полный package.json</summary>

```javascript
// package.json

$(cat ../package.json)
```

</details>

Также понадобится настроить IDE так, чтобы она тоже поддерживала новый синтаксис. Я пользуюсь Visual Studio Code; для нее нужно прописать в настройках проекта путь к локальному компилятору, а также переключиться на стандартный форматтер кода — `prettier` еще не переваривает новый синтаксис:

```javascript
// .vscode/settings.json

$(cat ../.vscode/settings.json)
```

Наконец, понадобится настроить сам компилятор. Для поддержки нового синтаксиса нужны опции `"lib": "esnext"` или `"lib": "esnext.disposable"`. Я также включаю поддержку ES-модулей.

<details><summary>Полный tsconfig.json</summary>

```javascript
// tsconfig.json

$(cat ../tsconfig.json)
```

</details>

## Синхронные ресурсы: подписки на события

Самый простой пример ресурса, за которым в JavaScript и TypeScript нужно следить вручную — это подписки на события. Конкретнее, от них во многих случаях нужно не забывать отписываться. В замыкании-обработчике события зачастую есть ссылка на объект-источник, а у источника есть ссылка на обработчик, что порождает цикл из ссылок на объекты в куче. Это может порождать неявные "висящие" ссылки, которые не дадуд GC собрать эту память:

```javascript
let listener = new SomeListener();
let emitter = new HeavyObject();

emitter.on("event", () => listener.onEvent(emitter));

/* ... */

emitter = null;
// emitter не соберется до тех пор, пока жив listener
```

Давайте на примере подписок посмотрим, как выглядит синтаксис управления ресурсами. Вот создание объекта-ресурса:

```javascript
// src/event-subscription.ts

$(cat ../src/event-subscription.ts)
```

Такие объекты должны удовлетворять интерфейсу `Disposable` — иметь метов `[Symbol.dispose]`, который и будет осуществлять освобождение ресурсов.

В качестве примера использования, напишем юнит-тест для функции `subscribe()`, используя еще одну из недавних фич Node.js — встроенную [поддержку запуска тестов]:

```javascript
// src/event-subscription.test.ts

$(cat ../src/event-subscription.test.ts)
```

Все работает как ожидается:

```bash
$ npm test | grep event-subscription
$(npm test | grep event-subscription)
```

## Асинхронные ресурсы: открытые файлы

Когда говорят про ручное управление ресурсами в контексте Node.js, чаще всего имеют в виду то, что я назову _асинхронными ресурсами_. Это открытые файлы, сокеты, подключения к базе данных — другими словами, те, что укладываются в такую модель использования:

```javascript
let resource: Resource;
try {
  // инициализируем ресурс асинхронным методом
  resource = await Resource.open();

  // используем ресурс
} finally {
  // освобождаем ресурс асинхронным методом
  await resource?.close();
}
```

Казалось бы, никакой специальный синтаксис для этого и не нужен: у нас есть `finally`, чего еще хотеть? Однако многословность такого подхода становится видна, если ресурсов несколько:

```javascript
let resourceA: ResourceA;
try {
  resourceA = await ResourceA.open();

  let resourceB: ResourceB;
  try {
    resourceB = await ResourceB.open(resourceA);
  } finally {
    await resourceB?.close();
  }
} finally {
  await resourceA?.close();
}
```

К тому же, неудобства доставляет то, что области видимости внутри блоков `try` и `finally` разные. Плюс, есть и место для неочевидных багов: всегда ли вы помнили о том, что в `finally` нужен знак `?`?

Новый синтаксис `using` делает использование ресурсов более удобным:

```javascript
// src/file.test.ts

$(cat ../src/file.test.ts)
```

Обратите внимание на запись `await using file = await ...`. Первый `await` здесь указывает на асинхронное освобождение ресурсов: при выходе области видимости будет выполнен `await file[Symbol.asyncDispose]()`. Второй — на асинхронную инициализацию: это просто вызов асинхронной `openFile()`.

Давайте посмотрим, как можно реализовать такую обертку для уже существующего ресурса. В нашем примере это будет `fs.FileHandle`.

```javascript
// src/file.ts

$(cat ../src/file.ts)
```

Запустим наши тесты:

```bash
$ npm test | grep file
$(npm test | grep file)
```

## "async-sync": мьютексы

Синтаксис `await using foo = await ...` может казаться не очень-то нужным повторением. Но на самом деле, несложно привести примеры ресурсов, у которых будут асинхронными только инициализация или только освобождение.

Как пример ресурса с асинхронной инициализацией, но синхронным освобождением приведу один из моих любимых применений паттерна RAII — мьютекс:

```javascript
// src/mutex.test.ts

$(cat ../src/mutex.test.ts)
```

Реализован наш `Mutex` как асинхронная фабрика `Disposable`-объектов:

```javascript
// src/mutex.ts

$(cat ../src/mutex.ts)
```

Что с тестами?

```bash
$ npm test | grep mutex
$(npm test | grep mutex)
```

## "sync-async": очередь задач

Как пример объекта с синхронной инициализацией и асинхронным освобождением, рассмотрим очередь задач:

```javascript
// src/task-queue.test.ts

$(cat ../src/task-queue.test.ts)
```

Ее реализация не слишком интересная, за исключением одной детали, о которой поговорим позже:

<details><summary>Реализация очереди</summary>

```javascript
// src/task-queue.ts

$(cat ../src/task-queue.ts)
```

</details>

Простые тесты проходят:

```bash
$ npm test | grep queue
$(npm test | grep queue)
```

## Используем все вместе: fetchCat

Для практики, напишем функцию `fetchCat()`, которая будет использовать все четыре определенных нами ресурса:

```javascript
// src/fetch-cat.ts

$(cat ../src/fetch-cat-incorrect.ts)
```

Опишем точку входа, распарсив агрументы встроенным в Node.js парсером — еще одна недавняя фича!

<details><summary>Код main.ts</summary>

```javascript
// src/main.ts

$(cat ../src/main.ts)
```

</details>

Зададим несколько URL для проверки в файле `urls.txt`, не забыв парочку «обманок» для проверки вывода ошибок:

```
$(cat ../urls.txt)
```

Запустим, чтобы проверить:

```bash
$ npm run demo
$(timeout 20s npm run demo:incorrect | sed 's/:incorrect//g')
```

Хм, странно. Скрипт не завершается, а выходной файл пустой. Похоже на баг.

## Неочевиндый баг

Чтобы найти, в чем ошибка, рассмотрим код подробнее:

```javascript
// src/fetch-cat.ts

$(cat ../src/fetch-cat-incorrect-explained.ts)
```

На самом деле, логическая ошибка не исправится, если просто переставить местами ресурсы. Она заключается в том, что время жизни `outFile` должно быть привязано не к текущей области видимости, а ко времени жизни задач в очереди. Файл должен быть закрыт не раньше, чем все задачи в очереди завершатся.

К сожалению, Node.js не позволяет замыканиям продлевать время жизни захваченных ими ресурсов. Придется связать их явно. Но все-таки не совсем вручную — для аггрерации ресурсов используем класс `AsyncDisposableStack` — еще одну часть пропозала:

```javascript
// src/fetch-cat.ts

$(cat ../src/fetch-cat.ts)
```

Проверим, получилось ли у нас исправить дело:

```bash
$ npm run demo
$(npm run demo 2>&1)
```

Отлично! Все (настоящие) страницы были загружены, а посмотрев в `./cat.html`, можем убедиться, что загружены правильно и без гонок.

Классы `DisposableStack` и `AsyncDisposableStack` предназначены для аггрегации нескольких ресурсов в один. Как правило, любой `Disposable`-ресурс, если у него есть под-ресурсы, должен иметь свой `DisposableStack`, и освобождать его у себя в `dispose()`. С `AsyncDisposable` и `AsyncDisposableStack` — аналогично.

## `habrArticle[Symbol.dispose]()`

Идея специального синтаксиса для паттерна RAII не нова — он есть как минимум [в C#] и [в Python]. Сегодня мы рассмотрели его реализацию из будущих версий JavaScript и TypeScript. У нее есть свои ограничения и неочевидные моменты. Но, несмотря на них, я очень рад появлению такого синтаксиса — и, надеюсь, смог объяснить, почему.

[в C#]: https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-8.0/using#using-declaration
[в Python]: https://docs.python.org/3/reference/compound_stmts.html#the-with-statement

Весь код доступен [в репозитории].

[в репозитории]: https://github.com/iliazeus/js-disposable-demo
