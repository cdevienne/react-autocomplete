'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var React = require('react');
var scrollIntoView = require('dom-scroll-into-view');
var throttle = require('lodash/throttle');

var _debugStates = [];

var Autocomplete = React.createClass({
  displayName: 'Autocomplete',

  propTypes: {
    value: React.PropTypes.any,
    onChange: React.PropTypes.func,
    onSelect: React.PropTypes.func,
    shouldItemRender: React.PropTypes.func,
    renderItem: React.PropTypes.func.isRequired,
    menuStyle: React.PropTypes.object,
    wrapperProps: React.PropTypes.object,
    wrapperStyle: React.PropTypes.object,
    inputProps: React.PropTypes.object
  },

  getDefaultProps: function getDefaultProps() {
    return {
      wrapperProps: {},
      wrapperStyle: {
        display: 'inline-block'
      },
      value: '',
      inputProps: {},
      onChange: function onChange() {},
      onSelect: function onSelect(value, item) {},
      renderMenu: function renderMenu(items, value, style) {
        return React.createElement('div', { style: _extends({}, style, this.menuStyle), children: items });
      },
      shouldItemRender: function shouldItemRender() {
        return true;
      },
      menuMinSize: 100,
      menuStyle: {
        borderRadius: '3px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '2px 0',
        fontSize: '90%',
        position: 'absolute',
        left: '0',
        overflow: 'auto'
      }
    };
  },

  getInitialState: function getInitialState() {
    return {
      isOpen: false,
      highlightedIndex: null
    };
  },

  componentWillMount: function componentWillMount() {
    this._ignoreBlur = false;
    this._performAutoCompleteOnUpdate = false;
    this._performAutoCompleteOnKeyUp = false;
  },

  componentDidMount: function componentDidMount() {
    this.setMenuPositionsThrottled = throttle(this.setMenuPositions.bind(this), 16);
    window.addEventListener('resize', this.setMenuPositionsThrottled);
    window.addEventListener('scroll', this.setMenuPositionsThrottled);
  },

  componentWillReceiveProps: function componentWillReceiveProps() {
    this._performAutoCompleteOnUpdate = true;
  },

  componentDidUpdate: function componentDidUpdate(prevProps, prevState) {
    if (this.state.isOpen === true && prevState.isOpen === false) this.setMenuPositions();

    if (this.state.isOpen && this._performAutoCompleteOnUpdate) {
      this._performAutoCompleteOnUpdate = false;
      this.maybeAutoCompleteText();
    }

    this.maybeScrollItemIntoView();
  },

  componentWillUnmount: function componentWillUnmount() {
    window.removeEventListener('resize', this.setMenuPositionsThrottled);
    window.removeEventListener('scroll', this.setMenuPositionsThrottled);
    this.setMenuPositionsThrottled.cancel();
    this.setMenuPositionsThrottled = null;
  },

  maybeScrollItemIntoView: function maybeScrollItemIntoView() {
    if (this.state.isOpen === true && this.state.highlightedIndex !== null) {
      var itemNode = React.findDOMNode(this.refs['item-' + this.state.highlightedIndex]);
      var menuNode = React.findDOMNode(this.refs.menu);
      scrollIntoView(itemNode, menuNode, { onlyScrollIfNeeded: true });
    }
  },

  handleKeyDown: function handleKeyDown(event) {
    console.log(event);
    if (this.keyDownHandlers[event.key]) this.keyDownHandlers[event.key].call(this, event);else {
      this.setState({
        highlightedIndex: null,
        isOpen: true
      });
    }
  },

  handleChange: function handleChange(event) {
    this._performAutoCompleteOnKeyUp = true;
    this.props.onChange(event, event.target.value);
  },

  handleKeyUp: function handleKeyUp() {
    if (this._performAutoCompleteOnKeyUp) {
      this._performAutoCompleteOnKeyUp = false;
      this.maybeAutoCompleteText();
    }
  },

  keyDownHandlers: {
    ArrowDown: function ArrowDown(event) {
      event.preventDefault();
      var highlightedIndex = this.state.highlightedIndex;

      var index = highlightedIndex === null || highlightedIndex === this.getFilteredItems().length - 1 ? 0 : highlightedIndex + 1;
      this._performAutoCompleteOnKeyUp = true;
      this.setState({
        highlightedIndex: index,
        isOpen: true
      });
    },

    ArrowUp: function ArrowUp(event) {
      event.preventDefault();
      var highlightedIndex = this.state.highlightedIndex;

      var index = highlightedIndex === 0 || highlightedIndex === null ? this.getFilteredItems().length - 1 : highlightedIndex - 1;
      this._performAutoCompleteOnKeyUp = true;
      this.setState({
        highlightedIndex: index,
        isOpen: true
      });
    },

    Enter: function Enter(event) {
      var _this = this;

      if (this.state.isOpen === false) {
        // already selected this, do nothing
        return;
      } else if (this.state.highlightedIndex == null) {
        // hit enter after focus but before typing anything so no autocomplete attempt yet
        this.setState({
          isOpen: false
        }, function () {
          React.findDOMNode(_this.refs.input).select();
        });
      } else {
        var item = this.getFilteredItems()[this.state.highlightedIndex];
        var value = this.props.getItemValue(item);
        this.setState({
          isOpen: false,
          highlightedIndex: null
        }, function () {
          //React.findDOMNode(this.refs.input).focus() // TODO: file issue
          React.findDOMNode(_this.refs.input).setSelectionRange(value.length, value.length);
          _this.props.onSelect(value, item);
        });
      }
    },

    Escape: function Escape(event) {
      this.setState({
        highlightedIndex: null,
        isOpen: false
      });
    }
  },

  getFilteredItems: function getFilteredItems() {
    var _this2 = this;

    var items = this.props.items;

    if (this.props.shouldItemRender) {
      items = items.filter(function (item) {
        return _this2.props.shouldItemRender(item, _this2.props.value);
      });
    }

    if (this.props.sortItems) {
      items.sort(function (a, b) {
        return _this2.props.sortItems(a, b, _this2.props.value);
      });
    }

    return items;
  },

  maybeAutoCompleteText: function maybeAutoCompleteText() {
    var _this3 = this;

    if (this.props.value === '') return;
    var highlightedIndex = this.state.highlightedIndex;

    var items = this.getFilteredItems();
    if (items.length === 0) return;
    var matchedItem = highlightedIndex !== null ? items[highlightedIndex] : items[0];
    var itemValue = this.props.getItemValue(matchedItem);
    var itemValueDoesMatch = itemValue.toLowerCase().indexOf(this.props.value.toLowerCase()) === 0;
    if (itemValueDoesMatch) {
      var node = React.findDOMNode(this.refs.input);
      var setSelection = function setSelection() {
        node.value = itemValue;
        node.setSelectionRange(_this3.props.value.length, itemValue.length);
      };
      if (highlightedIndex === null) this.setState({ highlightedIndex: 0 }, setSelection);else setSelection();
    }
  },

  setMenuPositions: function setMenuPositions() {
    var node = React.findDOMNode(this.refs.input);
    var rect = node.getBoundingClientRect();
    var computedStyle = getComputedStyle(node);
    var marginBottom = parseInt(computedStyle.marginBottom, 10);
    var marginLeft = parseInt(computedStyle.marginLeft, 10);
    var marginRight = parseInt(computedStyle.marginRight, 10);
    var marginTop = parseInt(computedStyle.marginTop, 10);

    var inputTop = rect.top - marginTop;
    var inputBottom = rect.bottom + marginBottom;

    var heightBefore = inputTop;
    var heightAfter = window.innerHeight - inputBottom;

    var displayBefore = heightAfter < this.props.menuMinSize + 10 && heightBefore > heightAfter;

    this.setState({
      menuWidth: rect.width + marginLeft + marginRight,
      menuMaxHeight: (displayBefore ? heightBefore : heightAfter) - 10,
      menuPosition: displayBefore ? 'before' : 'after'
    });
  },

  highlightItemFromMouse: function highlightItemFromMouse(index) {
    this.setState({ highlightedIndex: index });
  },

  selectItemFromMouse: function selectItemFromMouse(item) {
    var _this4 = this;

    var value = this.props.getItemValue(item);
    this.setState({
      isOpen: false,
      highlightedIndex: null
    }, function () {
      _this4.props.onSelect(value, item);
      React.findDOMNode(_this4.refs.input).focus();
      _this4.setIgnoreBlur(false);
    });
  },

  setIgnoreBlur: function setIgnoreBlur(ignore) {
    this._ignoreBlur = ignore;
  },

  renderMenu: function renderMenu() {
    var _this5 = this;

    var items = this.getFilteredItems().map(function (item, index) {
      var element = _this5.props.renderItem(item, _this5.state.highlightedIndex === index, { cursor: 'default' });
      return React.cloneElement(element, {
        onMouseDown: function onMouseDown() {
          return _this5.setIgnoreBlur(true);
        },
        onMouseEnter: function onMouseEnter() {
          return _this5.highlightItemFromMouse(index);
        },
        onClick: function onClick() {
          return _this5.selectItemFromMouse(item);
        },
        ref: 'item-' + index
      });
    });
    var style = {
      minWidth: this.state.menuWidth,
      maxHeight: this.state.menuMaxHeight
    };
    if (this.state.menuPosition === 'before') {
      style.bottom = '100%';
    } else if (this.state.menuPosition === 'after') {
      style.top = '100%';
    }
    var menu = this.props.renderMenu(items, this.props.value, style);
    return React.cloneElement(menu, { ref: 'menu' });
  },

  handleInputBlur: function handleInputBlur() {
    if (this._ignoreBlur) return;
    this.setState({
      isOpen: false,
      highlightedIndex: null
    });
  },

  handleInputFocus: function handleInputFocus() {
    if (this._ignoreBlur) return;
    this.setState({ isOpen: true });
  },

  handleInputClick: function handleInputClick() {
    if (this.state.isOpen === false) this.setState({ isOpen: true });
  },

  render: function render() {
    var _this6 = this;

    if (this.props.debug) {
      // you don't like it, you love it
      _debugStates.push({
        id: _debugStates.length,
        state: this.state
      });
    }
    return React.createElement(
      'div',
      _extends({}, this.props.wrapperProps, { style: _extends({ position: 'relative' }, this.props.wrapperStyle) }),
      React.createElement('input', _extends({}, this.props.inputProps, {
        role: 'combobox',
        'aria-autocomplete': 'both',
        ref: 'input',
        onFocus: this.handleInputFocus,
        onBlur: this.handleInputBlur,
        onChange: function (event) {
          return _this6.handleChange(event);
        },
        onKeyDown: function (event) {
          return _this6.handleKeyDown(event);
        },
        onKeyUp: function (event) {
          return _this6.handleKeyUp(event);
        },
        onClick: this.handleInputClick,
        value: this.props.value
      })),
      this.state.isOpen && this.renderMenu(),
      this.props.debug && React.createElement(
        'pre',
        { style: { marginLeft: 300 } },
        JSON.stringify(_debugStates.slice(_debugStates.length - 5, _debugStates.length), null, 2)
      )
    );
  }
});

module.exports = Autocomplete;