define(function(require, exports, module) {

  "use strict";

  var app = require('app');
  var UIManager = require('./UIManager');

  var UIContainer = Backbone.Layout.extend({

    tagName: 'li',

    attributes: {
      'class': 'batchcontainer'
    },

    template: 'uicontainer',

    events: {
      'click [name="batchedit"]': function() {
        this.$('.fieldset-smoke').toggle();
      }
    },

    serialize: function() {
      return {id: this.model.id, comment: this.model.get('comment'), batchEdit: this.options.batchEdit};
    },

    afterRender: function() {
      if (this.model.isRequired()) {
        this.$el.addClass('required');
      }
    }

  });

  var EditView = module.exports = Backbone.Layout.extend({

    tagName: "form",

    hiddenFields: [
      'id',
      'sort'
    ],

    template: Handlebars.compile("<ul class='fields'></ul>"),

    beforeRender: function() {
      var views = {};

      this.structure.each(function(column) {

        // Skip ID & active
        if('id' == column.id) {
          return;
        }

        if('active' == column.id) {
          if(this.options.collectionAdd) {
            this.model.set('active', 1);
          }


        }

        var view = UIManager.getInputInstance(this.model, column.id, {structure: this.structure, inModal: this.inModal});

        // Display:none; hidden fields
        var isHidden = _.contains(this.hiddenFields, column.id);
        if (isHidden) {
          // return;
          view.$el.css({'display':'none'});
        }

        // @todo: move this to UI
        view.$el.attr('id', 'edit_field_'+column.id);

        if (column.isRequired()) {
          view.$el.addClass('required');
        }

        if (!isHidden) {
          var uiContainer = new UIContainer({model: column, batchEdit: this.options.batchIds !== undefined});
          uiContainer.insertView('.trow', view);
          views[column.id] = uiContainer;
        } else {
          this.insertView('.fields',view);
        }
      }, this);

      var that = this;
      if(this.model.table) {
        var grouping = this.model.table.get('column_groupings');
        var i = 1;
        if(grouping) {
          grouping.split('^').forEach(function(group) {
            var title = "";
            if(group.indexOf(':') != -1) {
              title = group.substring(0, group.indexOf(':'));
              group = group.substring(group.indexOf(':') + 1);
            }
            var compileString = "<span>" + title + "</span><div></div>";
            that.insertView('.fields', new Backbone.Layout({attributes: {class:'gutter-bottom', id:'grouping_' + i}, template: Handlebars.compile(compileString)}));
            group.split(',').forEach(function(subgroup) {
              if(views[subgroup] !== undefined) {
                that.insertView('#grouping_' + i + ' div', views[subgroup]);
              }
            });
            i++;
          });
          return;
        }
      }

      for(var key in views) {
        that.insertView('.fields', views[key]);
      }
    },

    constructor: function (options) {
      Backbone.Layout.__super__.constructor.call(this, options);
      this.$el.addClass('two-column-form');
    },

    // Focus on first input
    afterRender: function() {
      var $first = this.$el.find(':input:first:visible');
      $first.focus();
      $first.val($first.val());

      // If this is a nested collection (to-Many) "Add" modal, preset & hide the parent foreign key.
      if(this.options.collectionAdd && !_.isEmpty(this.options.parentField)) {
        this.model.set(this.options.parentField.name, this.options.parentField.value);
        var $select = this.$el.find('[name=' + this.options.parentField.name + ']');
        $select.closest('fieldset').hide();
      }

    },

    data: function() {
      var data = this.$el.serializeObject();
      var whiteListedData = _.pick(data, this.visibleFields);
      // check if any of the listed data has multiple values, then serialize it to string
      _.each(whiteListedData, function(value, key, obj) {
        if (_.isArray(value)) {
          obj[key] = value.join(',');
        }
      });
      return whiteListedData;
    },

    initialize: function(options) {

      var structureHiddenFields,
          optionsHiddenFields = options.hiddenFields || [];

      this.inModal = options.inModal || false;
      this.structure = options.structure || this.model.getStructure();

      if (this.structure === undefined) {
        throw new Error('The edit view will not work without a valid model schema');
      }

      // Hide fields defined as hidden in the schema
      structureHiddenFields = this.structure.chain()
        .filter(function(column) { return column.get('hidden_input'); })
        .pluck('id')
        .value();

      this.hiddenFields = _.union(optionsHiddenFields, structureHiddenFields, this.hiddenFields);
      this.visibleFields = _.difference(this.structure.pluck('id'), this.hiddenFields);

      // @todo rewrite this!
      this.model.on('invalid', function(model, errors) {
        //Get rid of all errors
        this.$el.find('.error').remove();
        _.each(errors, function(item) {
          var $fieldset = $('#edit_field_' + item.attr);
          if ($fieldset.find('.error').length < 1) {
            $fieldset.append('<span class="error">'+item.message+'</span>');
          }
        });
      }, this);

      this.model.on('sync', function(e) {
        this.model.changed = {};
        this.render();
      }, this);
    }
  });

});