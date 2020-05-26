import {sum} from '../src/fake'

describe("Fake script", () => {
    describe("Sum", () => {
        it("Should add two values ", () => {
            expect(sum(2,4) === 6)
        })
    })
})