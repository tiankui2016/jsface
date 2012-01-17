/*
 * JSFace Object Oriented Programming Library
 * https://github.com/tannhu/jsface
 *
 * Copyright (c) 2009-2012 Tan Nhu
 * Licensed under MIT license (https://github.com/tannhu/jsface/blob/master/MIT-LICENSE.txt).
 *
 * Date: Saturday, March 07 2009
 * Version: 2.0.1
 */
(function(context, undefined) {
   var OBJECT      = "object",
       NUMBER      = "number",
       LENGTH      = "length",
       INVALID     = "Invalid params",
       readyFns    = [],
       oldClass, jsface;

   /**
    * Check an object is a map or not. A map is something like { key1: value1, key2: value2 }.
    */
   function isMap(obj) {
      return (obj && typeof obj === OBJECT && !(typeof obj.length === NUMBER && !(obj.propertyIsEnumerable(LENGTH))));
   }

   /**
    * Check an object is an array or not. An array is something like [].
    */
   function isArray(obj) {
      return (obj && typeof obj === OBJECT && typeof obj.length === NUMBER && !(obj.propertyIsEnumerable(LENGTH)));
   }

   /**
    * Check an object is a function or not.
    */
   function isFunction(obj) {
      return (obj && typeof obj === "function");
   }

   /**
    * Check an object is a string not.
    */
   function isString(obj) {
      return Object.prototype.toString.apply(obj) === "[object String]";
   }

   /**
    * Check an object is a class (not an instance of a class, which is a map) or not.
    */
   function isClass(clazz) {
      return isFunction(clazz) && (clazz === clazz.prototype.constructor);
   }

   /**
    * Loop over a collection (a string, an array, an object (a map with pairs of {key:value})), or a function (over all
    * static properties).
    * Over a String or Array, fn is executed as: fn(value, index, collection) Otherwise: fn(key, value, collection).
    * Return Infinity on fn will stop the iteration. each returns an array of results returned by fn.
    */
   function each(collection, fn) {
      var iArray, iMap, iString, iFunction, item, i, r, v, len, result = [];

      if ( !collection || !fn) { return; }

      iString   = isString(collection);
      iArray    = isArray(collection) || iString;
      iMap      = isMap(collection);
      iFunction = isFunction(collection);

      // convert to array if collection is not a collection itself
      if ( !iArray && !iMap && !iFunction) {
         collection = [ collection ];
         iArray     = 1;
      }

      if (iArray) {
         for (i = 0, len = collection.length; i < len; i++) {
            v = iString ? collection.charAt(i) : collection[i];
            if ((r = fn(v, i, collection)) === Infinity) { break; }
            result.push(r);
         }
      } else {
         for (item in collection) {
            if ((r = fn(item, collection[item], collection)) === Infinity) { break; }
            result.push(r);
         }
      }
      return result;
   }

   /**
    * Make $super method.
    */
   function makeSuper(child, parent) {
      child.prototype.$super = function() {
         var caller  = arguments.callee.caller,
             supez   = this.$super,
             result, name, len, func, pa;

         if (caller === child.prototype.constructor) {                      // caller is constructor
            func = parent ? parent[0] : 0;
            if (isClass(func)) { this.$super = func.prototype.$super; }     // $super = parent.$super
         } else if (parent) {                                               // caller is a method: query its name
            each(child.prototype, function(key, fn) {
               if (fn === caller) {
                  name = key;                                               // found you
                  return Infinity;                                          // break each loop
               }
            });

            len = parent.length ;                                           // order: most right parent first
            while (len-- && !func) {
               pa = parent[len];                                            // pa could be an instant
               if (isClass(pa)) { pa = pa.prototype; }                      // or a class
               func = pa[name] || 0;
            }

            if (isFunction(func)) { this.$super = pa.$super; }              // $super = parent.$super
         }

         if (isFunction(func)) {                                            // no harm, not found? fine
            result      = func.apply(this, arguments);                      // execute matched super method
            this.$super = supez;                                            // restore $super
            return result;
         }
      };
   }

   /**
    * Extend an object.
    */
   function extend(object, subject, ignoredKeys) {
      if (isArray(subject)) {
         return each(subject, function(sub) {
            extend(object, sub, ignoredKeys);
         });
      }

      var ignoredKeys = ignoredKeys || { constructor: 1, $super: 1, prototype: 1 },
          iClass      = isClass(object),
          isSubClass  = isClass(subject),
          oPrototype  = object.prototype, supez;

      function copier(key, value) {
         if ( !ignoredKeys || !ignoredKeys.hasOwnProperty(key)) {    // no copy ignored keys
            object[key] = value;                                     // do copy
            if (iClass) { oPrototype[key] = value; }                 // class? copy to prototype as well
         }
      }

      // copy static properties and prototype.* to object
      if (isMap(subject)) { each(subject, copier); }
      if (isSubClass) { each(subject.prototype, copier); }

      // second: prototype properties
      if (iClass && isSubClass) { extend(oPrototype, subject.prototype, ignoredKeys); }
   }

   /**
    * Create a class.
    */
   function Class(parent, api) {
      if ( !api) { parent = (api = parent, 0); }
      api = api || {};

      var tmp, clazz, constructor, singleton, statics,
          ignoredKeys = { constructor: 1, $singleton: 1, $statics: 1, prototype: 1 };

      parent = (parent && !isArray(parent)) ? [ parent ] : parent;             // convert to array
      api    = isFunction(api) ? api() : api;                                  // execute api if it's a function
      if ( !isMap(api)) { throw INVALID; }

      constructor = api.hasOwnProperty("constructor") ? api.constructor : 0;   // hasOwnProperty is a must, constructor is special
      singleton   = api.$singleton;
      statics     = api.$statics;

      each(Class.plugins, function(key) { ignoredKeys[key] = 1; });            // add plugins' keys into ignoredKeys

      // TODO Does jsface.overload work in case of CommonJS env?
      clazz = singleton ? {} : (constructor ? (Class.overload ? Class.overload("constructor", constructor) : constructor) : function() {});

      each(parent, function(p) { extend(clazz, p, ignoredKeys, true); });      // extend parent properties
      extend(singleton ? clazz : clazz.prototype, api, ignoredKeys);           // extend api
      extend(clazz, statics, ignoredKeys, true);                               // extend static properties

      if ( !singleton) { makeSuper(clazz, parent); }                           // make $super (no singleton support)
      each(Class.plugins, function(name, fn) { fn(clazz, parent, api); });     // pass control to plugins
      return clazz;
   }

   /* Built-in Class plugins */
   Class.plugins = {
      $ready: function(clazz, parent, api) {
         var r = api.$ready, count = 0, len = parent ? parent.length : 0;

         // in an environment where there are a lot of class creating/removing (rarely), this implementation might cause
         // a leak (saving pointers to clazz and $ready)
         each(readyFns, function(entry) {
            return each(parent, function(pa) {
               if (pa === entry[0]) {
                  entry[1].call(pa, clazz, api, parent);
               }
               if (count++ >= len ) { return Infinity; }
            });
         });

         if (isFunction(r)) {
            r.call(clazz, clazz, api, parent);
            readyFns.push([ clazz,  r ]);
         }
      }
   };

   /* Initialization */
   jsface = {
      Class      : Class,
      extend     : extend,
      each       : each,
      isMap      : isMap,
      isArray    : isArray,
      isFunction : isFunction,
      isString   : isString,
      isClass    : isClass
   };

   if (typeof module !== "undefined" && module.exports) { // support NodeJS/CommonJS
      module.exports = jsface;
   } else {
      oldClass          = context.Class;                  // save current Class namespace
      context.Class     = Class;                          // bind Class and jsface to global scope
      context.jsface    = jsface;
      jsface.noConflict = function() {                    // support no conflict
         context.Class = oldClass;
      }
   }
})(this);
