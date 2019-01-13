function SerializerMock() {
    console.info('Mock serializer instance created.');
}

SerializerMock.TestErrorMessage = "Test parsing error.";

SerializerMock.prototype.deserFailure = false;
SerializerMock.prototype.serFailure = false;

SerializerMock.prototype.parse = function(data) {
    if (this.deserFailure === true) {
        throw Error(SerializerMock.TestErrorMessage);
    }
    return JSON.parse(data);
}

SerializerMock.prototype.stringify = function(value) {
    if (this.serFailure === true) {
        throw Error(SerializerMock.TestErrorMessage);
    }
    return JSON.stringify(value);
}

module.exports = SerializerMock;
