export class DataType {
    constructor(public type: string, public isAutoIncrement: boolean = false) { }

    autoIncrement() {
        return new DataType(this.type, true);
    }

    toString() {
        return this.type;
    }
}

export const DataTypes = {
    String: new DataType('string'),
    Number: new DataType('number'),
    Boolean: new DataType('boolean'),
    JSON: new DataType('json'),
    UUID: new DataType('uuid'),
    CUID: new DataType('cuid')
};
