import RadQL from '../../src'

import { field
       , mutation
       , type
       , args
       , description

       , RadAPI
       , RadType
       , RadService
       , RadUnion
       , RadInterface

       } from '../../src'

class API extends RadAPI {

  static description = "My Fun API"
  static args = { foo: "string"
                }

  constructor(root, { foo }) {
    super(root)
    this._foo = foo
    this._req = root.req.foo
  }

  @ field("string")
  foo() {
    return this._foo
  }

  @ field("string")
  req() {
    return this._req
  }

  @ field
    ( "integer"
    , { arr: [ "number!" ] }
    )
  bar({ arr }) {
    return arr.length
  }

}

class AnimalAPI extends RadAPI {

  @ field("Dog")
  dog() {
    return this.e$.Dog({ name: "Sparky" })
  }

  @ field("Cat")
  cat() {
    return this.e$.Cat({ name: "Cuddles" })
  }

  @ field("Snek")
  snek() {
    return this.e$.Snek()
  }

  @ field([ "Animal" ])
  animals() {
    return [ this.e$.Snek()
           , this.e$.Dog({ name: "Sparky II." })
           , this.e$.Cat({ name: "Cuddles the Magnificent" })
           ]
  }

  @ field([ "Pet" ])
  pets() {
    return [ this.e$.Dog({ name: "Sparky the Third, May His Name Reach a Thousand Stars" })
           , this.e$.Cat({ name: "Madame Cuddles the Everlasting" })
           ]
  }

}

class Dog extends RadType {

  static args = { name: "string" }
  static description = "all dogs are boys"
  static interfaces = [ "Pet" ]

  constructor(root, { name }) {
    super(root)
    this._name = name
  }

  @ field("string")
  @ args({ nick: "boolean" })
  name({ nick }) {
    return nick
      ? `Mr. ${this._name}`
      : this._name
  }

  @ field("string")
  species() {
    return "Dog"
  }

  @ field("string")
  bark() {
    return "woof"
  }

}

class Cat extends RadType {

  static args = { name: "string" }
  static description = "all dogs are girls"
  static interfaces = [ "Pet" ]

  constructor(root, { name }) {
    super(root)
    this._name = name
  }

  @ field("string")
  @ args({ nick: "boolean" })
  name({ nick }) {
    return nick
      ? `Little Ms. ${this._name}`
      : this._name
  }

  @ field("string")
  species() {
    return "Cat"
  }

  @ field("string")
  purr() {
    return "meow"
  }

}

class Snek extends RadType {

  @ field("string")
  hiss() {
     return "i am a snek"
  }

}

const Animal = RadUnion( "Animal", [ "Dog", "Cat", "Snek" ] )

const Pet = RadInterface
  ( "Pet"
  , { name:    { type: "string", args: { nick: "boolean" } }
    , species: { type: "string" }
    }
  )

const APIs = [ API, AnimalAPI ]
const Types = [ Animal, Pet, Dog, Cat, Snek ]
const Services = [  ]

const rql = RadQL(APIs, Types, Services)

function serve(query) {
  return rql.serve(query, null, { foo: "foo" })
}

export { serve }
