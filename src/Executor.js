import Promise from 'bluebird'
import _       from 'lodash'

export default function(registry, req, opts = {}) {

  const { trace, time } = opts

  // number of round trips
  let rtCount = 0

  // state store
  const state = {}

  // promise store
  const cache = {}

  // job queue
  let queue = []

  // dispatcher state
  let curJob = Promise.resolve()
  let nextJob = null

  const e$ =
    // DATA FETCHER
    { fetch(r) {
        // not cacheable, move on with our lives
        if (!r.key)
          return enqueue(r)
        // mutation
        if (r.busts)
          return cache[r.src.constructor.__name][r.key] = enqueue(r)
        // check cache, enqueue if not found
        return cache[r.src.constructor.__name][r.key]
          || ( cache[r.src.constructor.__name][r.key] = enqueue(r) )
      }

    // STATE STORE
    , get:  key         => state[key]
    , set: (key, value) => state[key] = value

    // CONVENIENCE METHODS
    , all: rs => Promise.all(_.map(rs, e$.fetch))
    , map: ( rs, f ) => e$.all( _.map( rs, f ) )

    // CACHE BUSTING TOOLS
    , bustKey: (src, key) => cache[src][key] = null
    , bustSrc: src => cache[src] = {}
    , setKey: (src, key, value) => cache[src][key] = value

    }

  // root value
  const root = { e$, req, opts }

  // create object constructors
  const types = _.mapValues
    ( registry.types
    , (s, name) => {
        // create object cache
        cache[name] = {}
        // object factory
        const resolve = function(args) {
          if (!s.key) // no caching mechanism, return as-is
            return Promise.resolve(s.get(root, args))
          const k = s.key(args)
          return cache[name][k]
            || ( cache[name][k] = Promise.resolve(s.get(root, args)) )
        }
        for (let key in s) {
          if (s[key].service)
            resolve[key] = (...args) => s[key](root, ...args)
        }
        // object fields
        return resolve
      }
    )

  // service store
  const services = {}
  // bind service getters
  _.forEach
    ( registry.services
    , (s, name) => {
        // initialize cache
        cache[name] = {}
        Object.defineProperty
          ( e$
          , name
          , { enumerable: true
            , get() {
                return services[name]
                  || ( services[name] = new s(root) )
              }
            })
      }
    )

  return _.assign(e$, types)

  // flushes the job queue
  function dispatchQueue() {
    const n = rtCount++
    if (trace)
      console.log(`DISPATCHING Request #${n}`)
    // copy and swap queue
    let q = queue
    queue = []

    // group jobs by type
    const jobs = _.groupBy(q, 'req.src.constructor.__name')

    nextJob = null // copy and swap jobs
    return curJob = Promise.all // map all job groups to their exec fn
      ( _.map ( jobs, js => js[0].req.src._fetch(js, opts, n) ) )
      .then(() => {
        if (trace)
          console.log(`DISPATCHED Request #${n}`)
      })

  }

  // adds a request to the job queue
  function enqueue(req) {
    return new Promise((resolve, reject) => {
      // push job to queue
      queue.push ( { req, resolve, reject } )
      // call dispatch if there's no waiting job
      if (!nextJob)
        nextJob = curJob.then(dispatchQueue)
    })
  }

}
