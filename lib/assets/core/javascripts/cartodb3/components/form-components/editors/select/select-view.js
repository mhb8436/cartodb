var Backbone = require('backbone');
var EditorHelpers = require('../editor-helpers-extend');
var _ = require('underscore');
var CustomListCollection = require('../../../custom-list/custom-list-collection');
var selectedItemTemplate = require('./select-item.tpl');
var CustomListItemView = require('../../../custom-list/custom-list-item-view');
var itemListTemplate = require('../../../custom-list/custom-list-item.tpl');
var template = require('./select.tpl');
var PopupManager = require('../../../popup-manager');
var SelectListView = require('./select-list-view');

var ENTER_KEY_CODE = 13;

Backbone.Form.editors.Select = Backbone.Form.editors.Base.extend({

  tagName: 'div',
  className: 'u-ellipsis Editor-formSelect',

  events: {
    'click .js-button': '_onButtonClick',
    'keydown .js-button': '_onButtonKeyDown',
    'focus .js-button': function () {
      this.trigger('focus', this);
    },
    'blur': function () {
      this.trigger('blur', this);
    }
  },

  options: {
    selectedItemTemplate: selectedItemTemplate,
    itemListTemplate: itemListTemplate,
    customListItemView: CustomListItemView
  },

  initialize: function (opts) {
    Backbone.Form.editors.Base.prototype.initialize.call(this, opts);
    EditorHelpers.setOptions(this, opts);

    this.template = opts.template || template;
    this.dialogMode = this.options.dialogMode || 'nested';

    if (this.options.options != null) {
      this.collection = new CustomListCollection(this.options.options);
    } else {
      this.collection = this.options.collection;
    }

    if (this.collection.isAsync === undefined) {
      throw new Error('collection must implement isAsync method.');
    }

    this._initViews();
    this.setValue(this.model.get(this.options.keyAttr));
    this._initBinds();
  },

  render: function () {
    var isEmpty = !this.collection.length;
    var isNull = !this._hasValue();
    this._isDisabled = !isEmpty ? this.options.disabled : true;
    var placeholder = this._getPlaceholder(this._isDisabled);
    var label = isNull ? placeholder : this._getLabel();
    var isLoading = this._isLoading();

    this.$el.html(this.template({
      keyAttr: this.options.keyAttr,
      isEmpty: isEmpty,
      label: label,
      isDisabled: this._isDisabled,
      isNull: isNull,
      isLoading: isLoading
    }));

    // we are replacing the html, so we need to re append if nested mode
    if (this.dialogMode === 'nested') {
      this._popupManager.append(this.dialogMode);
    }

    if (!isLoading) {
      this._renderSelected();
    }

    return this;
  },

  _initBinds: function () {
    var hide = function () {
      this._listView.hide();
      this._popupManager.untrack();
    }.bind(this);

    this.applyESCBind(hide);
    this.applyClickOutsideBind(hide);

    this.listenTo(this.collection, 'change:selected', this._onItemSelected);

    if (this.collection.isAsync()) {
      this.listenTo(this.collection.stateModel, 'change:state', this.render);
    }
  },

  _initViews: function () {
    this._listView = new SelectListView({
      collection: this.collection,
      showSearch: this.options.showSearch,
      allowFreeTextInput: this.options.allowFreeTextInput,
      typeLabel: this.options.keyAttr,
      itemTemplate: this.options.itemListTemplate,
      itemView: this.options.customListItemView,
      position: this.options.position,
      searchPlaceholder: this.options.searchPlaceholder
    });

    this._popupManager = new PopupManager(this.cid, this.$el, this._listView.$el);
    this._popupManager.append(this.dialogMode);
  },

  _getPlaceholder: function (isDisabled) {
    var keyAttr = this.options.keyAttr;
    var placeholder;

    if (isDisabled) {
      placeholder = this.options.disabledPlaceholder || _t('components.backbone-forms.select.disabled-placeholder', { keyAttr: keyAttr });
    } else {
      placeholder = this.options.placeholder || _t('components.backbone-forms.select.placeholder', { keyAttr: keyAttr });
    }

    return placeholder;
  },

  _hasValue: function () {
    var name = this.model.get(this.options.keyAttr);
    return name != null && name !== '';
  },

  _getLabel: function () {
    var name = this.model.get(this.options.keyAttr);
    var mdl = this.collection.findWhere({val: name});
    return mdl && mdl.getName() || name || '';
  },

  _isLoading: function () {
    var isLoading = this.options.loading;

    if (this.collection.isAsync()) {
      isLoading = this.collection.stateModel.get('state') === 'fetching';
    }

    return isLoading;
  },

  _destroyBinds: function () {
    this.stopListening(this.collection);
    Backbone.Form.editors.Base.prototype._destroyBinds.call(this);
  },

  _onItemSelected: function (mdl) {
    this._listView.hide();
    this._popupManager.untrack();
    this._renderButton(mdl).focus();
    this.trigger('change', this);
  },

  _onButtonClick: function (ev) {
    if (this._isDisabled) {
      return;
    }

    this._listView.toggle();
    this._listView.isVisible() ? this._popupManager.track() : this._popupManager.untrack();
  },

  _onButtonKeyDown: function (ev) {
    if (this._isDisabled) {
      return;
    }

    if (ev.which === ENTER_KEY_CODE) {
      ev.preventDefault();
      if (!this._listView.isVisible()) {
        ev.stopPropagation();
        this._listView.toggle();
      } else {
        this._popupManager.track();
      }
    }
  },

  getValue: function () {
    var item = this.collection.getSelectedItem();
    if (item) {
      return item.getValue();
    } else {
      return this.value;
    }
  },

  setValue: function (value) {
    var selectedModel = this.collection.setSelected(value);
    if (selectedModel) {
      this._renderButton(selectedModel);
    } else {
      this.render();
    }
    this.value = value;
  },

  _renderSelected: function () {
    var selectedModel = this.collection.getSelectedItem();
    if (selectedModel) {
      this._renderButton(selectedModel);
    }
  },

  _renderButton: function (mdl) {
    var button = this.$('.js-button');
    var data = _.extend({}, mdl.attributes, { label: mdl.getName() });
    var $html = this.options.selectedItemTemplate(data);

    button
      .removeClass('is-empty')
      .html($html);

    return button;
  },

  remove: function () {
    this._popupManager && this._popupManager.destroy();
    this._listView && this._listView.clean();
    this._destroyBinds();
    Backbone.Form.editors.Base.prototype.remove.call(this);
  }
});
