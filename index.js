var _   = require('lodash')
  , req = require('superagent')
  , q   = require('q')
;

module.exports = {
    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {
        var workspace   = step.input('workspace').toArray()
          , project     = step.input('project').toArray()
          , credentials = dexter.provider('asana').credentials('access_token')
          , followers   = step.input('followers').toArray()
          , assignee    = step.input('assignee').toArray()
          , notes       = step.input('notes').toArray()
          , external_id = step.input( 'external_id' ).toArray()
          , names       = step.input('name')
          , promises    = []
          , data        = {}
        ;


        names.each(function(name, idx) {
            var data = { name: name }
              , request = req.post('https://app.asana.com/api/1.0/tasks')
                            .set('Authorization', 'Bearer '+credentials)
                            .type('json')
            ;

            _.each(['assignee', 'notes', 'followers', 'workspace', 'project', 'external_id'], function(key) {
                //try the on index item, if not just use the first item
                setIfExists(data, key, step.input(key)[idx] || step.input(key).first());
            });

            //normalize projects to an array
            if(data.project) {
                data.projects = _.isArray(data.project) ? data.project : [ data.project ];
                delete data.project;
            }

            //names don't match inputs for external_id <=> external, need to map
            if(data.external_id) {
                data.external = {id: data.external_id};
                delete data.external_id;
            }

            request = request.send({ data: data });

            promises.push(
                promisify(request, 'end', 'body.data')
            );
        });

        q.all(promises)
          .then(this.complete.bind(this))
          .catch(this.fail.bind(this));
    }
};

function promisify(scope, call, path) {
    var deferred = q.defer(); 

    scope[call](function(err, result) {
        return err
          ? deferred.reject(err)
          : deferred.resolve(_.get(result, path))
        ;
    });

    return deferred.promise;
}

function setIfExists(obj, key, value) {
    if(value !== null & value !== undefined) {
        obj[key] = value;
    }
}
