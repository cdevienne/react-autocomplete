const React = require('react')
const scrollIntoView = require('dom-scroll-into-view')
const throttle = require('lodash/throttle')

let _debugStates = []

let Autocomplete = React.createClass({

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

  getDefaultProps () {
    return {
      wrapperProps: {},
      wrapperStyle: {
        display: 'inline-block'
      },
      value: '',
      inputProps: {},
      onChange () {},
      onSelect (value, item) {},
      renderMenu (items, value, style) {
        return <div style={{...style, ...this.menuStyle}} children={items}/>
      },
      shouldItemRender () { return true },
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
    }
  },

  getInitialState () {
    return {
      isOpen: false,
      highlightedIndex: null,
    }
  },

  componentWillMount () {
    this._ignoreBlur = false
    this._performAutoCompleteOnUpdate = false
    this._performAutoCompleteOnKeyUp = false
  },

  componentDidMount () {
    this.setMenuPositionsThrottled = throttle(this.setMenuPositions.bind(this), 16);
    window.addEventListener('resize', this.setMenuPositionsThrottled);
    window.addEventListener('scroll', this.setMenuPositionsThrottled);
  },

  componentWillReceiveProps () {
    this._performAutoCompleteOnUpdate = true
  },

  componentDidUpdate (prevProps, prevState) {
    if (this.state.isOpen === true && prevState.isOpen === false)
      this.setMenuPositions()

    if (this.state.isOpen && this._performAutoCompleteOnUpdate) {
      this._performAutoCompleteOnUpdate = false
      this.maybeAutoCompleteText()
    }

    this.maybeScrollItemIntoView()
  },

  componentWillUnmount () {
    window.removeEventListener('resize', this.setMenuPositionsThrottled);
    window.removeEventListener('scroll', this.setMenuPositionsThrottled);
    this.setMenuPositionsThrottled.cancel();
    this.setMenuPositionsThrottled = null;
  },

  maybeScrollItemIntoView () {
    if (this.state.isOpen === true && this.state.highlightedIndex !== null) {
      var itemNode = React.findDOMNode(this.refs[`item-${this.state.highlightedIndex}`])
      var menuNode = React.findDOMNode(this.refs.menu)
      scrollIntoView(itemNode, menuNode, { onlyScrollIfNeeded: true })
    }
  },

  handleKeyDown (event) {
    console.log(event);
    if (this.keyDownHandlers[event.key])
      this.keyDownHandlers[event.key].call(this, event)
    else {
      this.setState({
        highlightedIndex: null,
        isOpen: true
      })
    }
  },

  handleChange (event) {
    this._performAutoCompleteOnKeyUp = true
    this.props.onChange(event, event.target.value)
  },

  handleKeyUp () {
    if (this._performAutoCompleteOnKeyUp) {
      this._performAutoCompleteOnKeyUp = false
      this.maybeAutoCompleteText()
    }
  },

  keyDownHandlers: {
    ArrowDown (event) {
      event.preventDefault()
      var { highlightedIndex } = this.state
      var index = (
        highlightedIndex === null ||
        highlightedIndex === this.getFilteredItems().length - 1
      ) ?  0 : highlightedIndex + 1
      this._performAutoCompleteOnKeyUp = true
      this.setState({
        highlightedIndex: index,
        isOpen: true,
      })
    },

    ArrowUp (event) {
      event.preventDefault()
      var { highlightedIndex } = this.state
      var index = (
        highlightedIndex === 0 ||
        highlightedIndex === null
      ) ? this.getFilteredItems().length - 1 : highlightedIndex - 1
      this._performAutoCompleteOnKeyUp = true
      this.setState({
        highlightedIndex: index,
        isOpen: true,
      })
    },

    Enter (event) {
      if (this.state.isOpen === false) {
        // already selected this, do nothing
        return
      }
      else if (this.state.highlightedIndex == null) {
        // hit enter after focus but before typing anything so no autocomplete attempt yet
        this.setState({
          isOpen: false
        }, () => {
          React.findDOMNode(this.refs.input).select()
        })
      }
      else {
        var item = this.getFilteredItems()[this.state.highlightedIndex]
        var value = this.props.getItemValue(item)
        this.setState({
          isOpen: false,
          highlightedIndex: null
        }, () => {
          //React.findDOMNode(this.refs.input).focus() // TODO: file issue
          React.findDOMNode(this.refs.input).setSelectionRange(
            value.length,
            value.length
          )
          this.props.onSelect(value, item)
        })
      }
    },

    Escape (event) {
      this.setState({
        highlightedIndex: null,
        isOpen: false
      })
    }
  },

  getFilteredItems () {
    let items = this.props.items

    if (this.props.shouldItemRender) {
      items = items.filter((item) => (
        this.props.shouldItemRender(item, this.props.value)
      ))
    }

    if (this.props.sortItems) {
      items.sort((a, b) => (
        this.props.sortItems(a, b, this.props.value)
      ))
    }

    return items
  },

  maybeAutoCompleteText () {
    if (this.props.value === '')
      return
    var { highlightedIndex } = this.state
    var items = this.getFilteredItems()
    if (items.length === 0)
      return
    var matchedItem = highlightedIndex !== null ?
      items[highlightedIndex] : items[0]
    var itemValue = this.props.getItemValue(matchedItem)
    var itemValueDoesMatch = (itemValue.toLowerCase().indexOf(
      this.props.value.toLowerCase()
    ) === 0)
    if (itemValueDoesMatch) {
      var node = React.findDOMNode(this.refs.input)
      var setSelection = () => {
        node.value = itemValue
        node.setSelectionRange(this.props.value.length, itemValue.length)
      }
      if (highlightedIndex === null)
        this.setState({ highlightedIndex: 0 }, setSelection)
      else
        setSelection()
    }
  },

  setMenuPositions () {
    var node = React.findDOMNode(this.refs.input)
    var rect = node.getBoundingClientRect()
    var computedStyle = getComputedStyle(node)
    var marginBottom = parseInt(computedStyle.marginBottom, 10)
    var marginLeft = parseInt(computedStyle.marginLeft, 10)
    var marginRight = parseInt(computedStyle.marginRight, 10)
    var marginTop = parseInt(computedStyle.marginTop, 10)

    var inputTop = rect.top - marginTop;
    var inputBottom = rect.bottom + marginBottom;

    var heightBefore = inputTop;
    var heightAfter = window.innerHeight - inputBottom;

    var displayBefore = heightAfter < (this.props.menuMinSize + 10) && heightBefore > heightAfter;

    this.setState({
        menuWidth: rect.width + marginLeft + marginRight,
        menuMaxHeight: (displayBefore ? heightBefore : heightAfter) - 10,
        menuPosition: displayBefore ? 'before' : 'after'
    });
  },

  highlightItemFromMouse (index) {
    this.setState({ highlightedIndex: index })
  },

  selectItemFromMouse (item) {
    var value = this.props.getItemValue(item);
    this.setState({
      isOpen: false,
      highlightedIndex: null
    }, () => {
      this.props.onSelect(value, item)
      React.findDOMNode(this.refs.input).focus()
      this.setIgnoreBlur(false)
    })
  },

  setIgnoreBlur (ignore) {
    this._ignoreBlur = ignore
  },

  renderMenu () {
    var items = this.getFilteredItems().map((item, index) => {
      var element = this.props.renderItem(
        item,
        this.state.highlightedIndex === index,
        {cursor: 'default'}
      )
      return React.cloneElement(element, {
        onMouseDown: () => this.setIgnoreBlur(true),
        onMouseEnter: () => this.highlightItemFromMouse(index),
        onClick: () => this.selectItemFromMouse(item),
        ref: `item-${index}`,
      })
    })
    var style = {
      minWidth: this.state.menuWidth,
      maxHeight: this.state.menuMaxHeight
    }
    if (this.state.menuPosition === 'before') {
        style.bottom = '100%';
    } else if (this.state.menuPosition === 'after') {
        style.top = '100%';
    }
    var menu = this.props.renderMenu(items, this.props.value, style)
    return React.cloneElement(menu, { ref: 'menu' })
  },

  handleInputBlur () {
    if (this._ignoreBlur)
      return
    this.setState({
      isOpen: false,
      highlightedIndex: null
    })
  },

  handleInputFocus () {
    if (this._ignoreBlur)
      return
    this.setState({ isOpen: true })
  },

  handleInputClick () {
    if (this.state.isOpen === false)
      this.setState({ isOpen: true })
  },

  render () {
    if (this.props.debug) { // you don't like it, you love it
      _debugStates.push({
        id: _debugStates.length,
        state: this.state
      })
    }
    return (
      <div {...this.props.wrapperProps} style={{position: 'relative', ...this.props.wrapperStyle}}>
        <input
          {...this.props.inputProps}
          role="combobox"
          aria-autocomplete="both"
          ref="input"
          onFocus={this.handleInputFocus}
          onBlur={this.handleInputBlur}
          onChange={(event) => this.handleChange(event)}
          onKeyDown={(event) => this.handleKeyDown(event)}
          onKeyUp={(event) => this.handleKeyUp(event)}
          onClick={this.handleInputClick}
          value={this.props.value}
        />
        {this.state.isOpen && this.renderMenu()}
        {this.props.debug && (
          <pre style={{marginLeft: 300}}>
            {JSON.stringify(_debugStates.slice(_debugStates.length - 5, _debugStates.length), null, 2)}
          </pre>
        )}
      </div>
    )
  }
})

module.exports = Autocomplete

