export class DataType {
    constructor(public type: string, public isAutoIncrement: boolean = false) { }

    toString() {
        return this.type;
    }
}

export class NumberDataType extends DataType {
    constructor(isAutoIncrement: boolean = false) {
        super('number', isAutoIncrement);
    }

    autoIncrement() {
        return new NumberDataType(true);
    }
}

export const DataTypes = {
    String: new DataType('string'),
    Number: new NumberDataType(),
    Boolean: new DataType('boolean'),
    JSON: new DataType('json'),
    UUID: new DataType('uuid'),
    CUID: new DataType('cuid')
};
