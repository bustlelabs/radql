import Promise from 'bluebird'
import _       from 'lodash'

export default function(registry, opts = {}) {

  const { trace, time } = opts

  // number of round trips
  let rtCount = 0

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
        // avoid undefined errors
        if (!cache[r.src.key]) cache[r.src.key] = {}
        // not cacheable, move on with our lives
        if (!r.key)
          return enqueue(r)
        // check cache, enqueue if not found
        return cache[r.src.key][r.key]
          || ( cache[r.src.key][r.key] = enqueue(r) )
      }

    // CONVENIENCE METHODS
    , all: rs => Promise.all(_.map(rs, e$.fetch))
    , map: ( rs, f ) => e$.all( _.map( rs, f ) )

    // CACHE BUSTING TOOLS
    , bustKey: (srcKey, key) => cache[srcKey]
                           && ( cache[srcKey][key] = null )
    , bustSrc: key => cache[key] = {}

    // construct an object bound to current e$ instance
    , new(t, ...args) {
        registry.type(t)(...args)
      }
    }

  const root = { e$, opts }
  // create object constructors
  const types = _.mapValues
    ( registry.types
    , (s, name) => {
        const resolve = function(args) {
          return s.new // if factory method is present
            ? s.new(root, args)
            : Promise.resolve(new s(root, args))
        }
        return resolve
      }
    )

  return _.assign(e$, types)

  // flushes the job queue
  function dispatchQueue() {
    let n = rtCount++
    if (trace)
      console.log(`DISPATCHING Request #${n}`)
    // copy and swap queue
    const q = queue
    queue = []

    // group jobs by type
    const jobs = _.groupBy(q, 'req.src.key')

    nextJob = null // copy and swap jobs
    return curJob = Promise.all // map all job groups to their exec fn
      ( _.map ( jobs, js => js[0].req.src.fetch(js, opts) ) )
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
