const defaultSettings = {
  format: Object,
  context: null,
  sort: {
    direction: 'asc'
  }
};
const filterSettings = {
  asc: [-1, 1],
  desc: [1, -1]
};

type dataFormat = {}|[];
type scalar = string|number;
type settingsFormat = {
  format?: ObjectConstructor,
  context?: dataFormat,
  sort?: {
    direction: string
  }
}

class Repository {
  public data: {}|[];

  /**
   * Инициализация полей, по которым будет производиться поиск
   * @param data
   */
  constructor(data: dataFormat) {
    this.data = data;
  }

  /**
   * Поиск одной записи по ключу
   * @param id
   */
  public findById(id: scalar): any
  {
    if (id in this.data) {
      return this.data[id];
    }
    return null;
  }

  /**
   * Поиск единственной записи по полному совпадению значения указанного поля
   * @param property
   * @param value
   * @param settings
   * @protected
   */
  protected findByFieldStrict(
    property: scalar,
    value: scalar,
    settings?: settingsFormat
  ): any
  {
    let context = this.getContext(settings);

    for (let key in context) {
      if (!context.hasOwnProperty(key)) { continue; }
      if (context[key][property] === value) {
        return context[key];
      }
    }
    return null;
  }

  /**
   * Получить все записи в указанном контексте
   * @param settings
   */
  public fetchAll(settings?: settingsFormat): dataFormat
  {
    settings = this.pullDefaultSettings(settings);
    return this.outFormatter(
      this.getContext(settings),
      settings
    );
  }

  /**
   * Получить все совпадения по строгому соответствию
   * @param property
   * @param value
   * @param settings
   * @protected
   */
  protected fetchByFieldStrict(
    property: scalar,
    value: scalar,
    settings?: settingsFormat
  ): dataFormat
  {
    settings = this.pullDefaultSettings(settings);
    let context = this.getContext(settings);

    let matches = [];
    for (let key in context) {
      if (!context.hasOwnProperty(key)) { continue; }
      if (context[key][property] == value) {
        matches.push(context[key]);
      }
    }

    return this.outFormatter(matches, settings);
  }

  /**
   * Получить все совпадения в LIKE-подобном режиме
   * @param property
   * @param value
   * @param settings
   * @protected
   */
  protected fetchByFieldWithLike(
    property: scalar,
    value: string,
    settings?: settingsFormat
  ): dataFormat
  {
    settings = this.pullDefaultSettings(settings);
    let context = this.getContext(settings);

    let matches = [];
    for (let key in context) {
      if (!context.hasOwnProperty(key)) { continue; }
      if (new RegExp(value, 'gmi').test(context[key][property])) {
        matches.push(context[key]);
      }
    }

    return this.outFormatter(matches, settings);
  }

  /**
   * Получить совпадения по нескольким полям в LIKE-подобном режиме
   * @param propertyList
   * @param value
   * @param settings
   * @protected
   */
  protected fetchByManyFieldsWithLike(
    propertyList: string[],
    value: string,
    settings?: settingsFormat
  ): dataFormat
  {
    settings = this.pullDefaultSettings(settings);
    let context = this.getContext(settings);
    let matches = [];

    for (let contextKey in context) {
      if (!context.hasOwnProperty(contextKey) || context[contextKey] === null) { continue; }

      for (let propertyListKey in propertyList) {
        let property = propertyList[propertyListKey];
        if (!propertyList.hasOwnProperty(propertyListKey)) { continue; }

        if (new RegExp(value, 'gmi').test(context[contextKey][property])) {
          matches.push(context[contextKey]);
          break;
        }
      }
    }

    return this.outFormatter(matches, settings);
  }

  /**
   * Фильтрация по значению указанного поля
   * @param property
   * @param settings
   * @protected
   */
  protected filter(
    property: string,
    settings?: settingsFormat
  ): dataFormat
  {
    settings = this.pullDefaultSettings(settings);
    let context = this.getContext(settings);
    let filterSetting = Repository.getFilterSettings(settings.sort.direction);

    let sortFunction = function (a, b) {
      let valueA = Repository.computeNestedProperty(a, property);
      let valueB = Repository.computeNestedProperty(b, property);

      if (valueA < valueB) {
        return filterSetting[0];
      }
      if (valueA > valueB) {
        return filterSetting[1];
      }

      return 0;
    };
    let result = this.toArray(context).sort(sortFunction);

    return this.outFormatter(result, settings);
  }

  /**
   * Получить поле из объекта по инструкции, передеанной в поле "property" в точечной нотачии
   * @param startValue
   * @param property
   * @private
   */
  private static computeNestedProperty(startValue: scalar, property: string): scalar
  {
    let propertyPath = property.split('.');
    let value = startValue;
    for (let temp of propertyPath) {
      value = value[temp];
    }

    return value;
  }

  /**
   * Приведение возвращаемых данных к желаемому формату
   * @param input
   * @param settings
   * @protected
   */
  protected outFormatter(
    input: dataFormat,
    settings?: settingsFormat
  ): dataFormat
  {
    settings = this.pullDefaultSettings(settings);

    if ((typeof settings.format) === (typeof Object)) {
      return this.toObject(input);
    } else if ((typeof settings.format) === (typeof Array)) {
      return this.toArray(input);
    }
    console.warn('Заявлен некорректный выходной формат данных репозитория');
  }

  /**
   * Привести сущность к массиву
   * @param object
   * @protected
   */
  protected toArray(object: dataFormat): any[]
  {
    let array = [];
    for (let key in object) {
      if (object.hasOwnProperty(key)) {
        array.push(object[key]);
      }
    }
    return array;
  }

  /**
   * Привести сущность к объекту
   * @param array
   * @protected
   */
  protected toObject(array: dataFormat): {}
  {
    let object = {};
    for (let key in array) {
      if (array.hasOwnProperty(key)) {
        object[key] = array[key];
      }
    }
    return object;
  }

  /**
   * Подтянуть настройки по умолчанию к пользовательским
   * @param settings
   * @protected
   */
  protected pullDefaultSettings(settings?: settingsFormat): settingsFormat
  {
    return  {...defaultSettings, ...settings};
  }

  /**
   * Получить контекст, в котором необходимо производить поиск/фильтрацию
   * @param settings
   * @protected
   */
  protected getContext(settings: settingsFormat = defaultSettings): dataFormat
  {
    return settings.context === null ? this.data : settings.context;
  }

  /**
   * Получение настроек для фильтраций
   * @param direction
   * @private
   */
  private static getFilterSettings(direction: string)
  {
    direction = direction.toLowerCase();

    switch (direction) {
      case 'asc': return filterSettings.asc;
      case 'desc': return filterSettings.desc;
      default: return filterSettings.asc;
    }
  }
}

export default Repository;
