import keycode from 'keycode';
import keyHandlers from './keyHandlers';
import helpers from './helpers';
import ValueHistory from './valueHistory';
import {ACTION_TYPES, DRAG_STATES, RANGE} from './constants';


/**
 * CONSTANTS
 */
const DEFAULTS = {
  scale: 2,
  range: RANGE.ALL,
  fixed: true,
  thousands: ',',
  decimal: '.',
  shortcuts: {
    'k': 1000,
    'm': 1000000,
    'b': 1000000000
  }
}

/**
 * FINPUT COMPONENT CLASS
 * @class
 */
class Finput {

  /**
   * Constructor
   * @param {DOM Element} The number input
   * @param {Options} Options for the number input's behaviour
   *
   * Detailed list of possible options:
   * @param {Options.scale} maximum number of decimal digits
   * @param {Options.range} Whether number can take any value or must be positive
   * @param {Options.fixed} After focus is lost - value is formatted to *scale* number of decimal places
   * @param {Options.thousands} Character to use for the thousands separator
   * @param {Options.decimal} Character to use for the decimal point
   * @param {Options.shortcuts} Object map of shortcut characters to multiplier (e.g. { k: 1000 })
   */
  constructor(element, options) {
    this._element = element;
    this._options = {
      ...DEFAULTS,
      ...options
    };

    this._actionTypes = this.createActionTypes();
    this._history = new ValueHistory();

    this._listeners = {
      blur:     { element: this.element, handler: this.onFocusout.bind(this) },
      focus:    { element: this.element, handler: this.onFocusin.bind(this) },
      drop:     { element: this.element, handler: this.onDrop.bind(this) },
      paste:    { element: this.element, handler: this.onPaste.bind(this) },
      keydown:  { element: this.element, handler: this.onKeydown.bind(this) },
      input:    { element: this.element, handler: this.onInput.bind(this) },

      dragstart:    { element: document, handler: this.onDragstart.bind(this) },
      dragend:    { element: document, handler: this.onDragend.bind(this) }
    }

    // Setup listeners
    this.removeListeners();
    for (let e in this._listeners) {
      this._listeners[e].element.addEventListener(e, this._listeners[e].handler);
    }
  }

  // GETTERS
  get element() {
    return this._element;
  }
  get options() {
    return this._options;
  }

  /**
   * Creates the correct action type to char/key codes array with the
   * correct decimal and thousand separator characters (depending on language)
   */
  createActionTypes() {
    return [
      {
        type: ACTION_TYPES.NUMBER,
        names: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
      },
      {
        type: ACTION_TYPES.MINUS,
        names: ['-']
      },
      {
        type: ACTION_TYPES.HOME,
        names: ['home']
      },
      {
        type: ACTION_TYPES.END,
        names: ['end']
      },
      {
        type: ACTION_TYPES.DECIMAL,
        names: [this.options.decimal]
      },
      {
        type: ACTION_TYPES.DELIMITER,
        names: [this.options.thousands]
      },
      {
        type: ACTION_TYPES.SHORTCUT,
        names: Object.keys(this.options.shortcuts)
      },
      {
        type: ACTION_TYPES.BACKSPACE,
        names: ['backspace']
      },
      {
        type: ACTION_TYPES.DELETE,
        names: ['delete']
      },
      {
        type: ACTION_TYPES.HORIZONTAL_ARROW,
        names: ['left', 'right']
      },
      {
        type: ACTION_TYPES.VERTICAL_ARROW,
        names: ['up', 'down']
      },
      {
        type: ACTION_TYPES.UNDO,
        names: ['z'],
        ctrl: true
      },
      {
        type: ACTION_TYPES.REDO,
        names: ['y'],
        ctrl: true
      }
    ]
  }
  /**
   * Determines what type of action needs to be dealt with from the current
   * keydown event. E.g. vertical arrow pressed, number pressed etc...
   * @param {e} Keyboard event
   */
  getActionType(name, e) {
    for (let actionType of this._actionTypes) {
      const index = actionType.names.indexOf(name);
      const typeMatch = index > -1;

      if (typeMatch && (actionType.ctrl ? e.ctrlKey : true)) {
        return actionType.type;
      }
    }
    return ACTION_TYPES.UNKNOWN;
  }

  /**
   * Get numerical value of the given value
   * @param {val} Value to convert
   */
  getRawValue(val) {
    return Number(this.element.value.replace(new RegExp(this.options.thousands, 'g'), ''));
  }


  /**
   * Sets the value, fully formatted, for the input
   * @param {val} New value to set
   */
  setValue(val, notNull) {
    const newValue = helpers.fullFormat(val, this.options);

    if (notNull ? val : true) {
      this.element.value = newValue;
      this.element.rawValue = this.getRawValue(this.element.value);
      this._history.addValue(newValue);
    }
  }

  //
  // EVENT HANDLERS
  //

  /**
   * On focusing OUT of the input - format fully
   * @param {e} Focus event
   */
  onFocusout(e) {
    console.debug('Focus OUT event', e);
    this.setValue(this.element.value);
  }
  /**
   * On focus of the input - Select all text
   * @param {e} Focus event
   */
  onFocusin(e) {
    console.debug('Focus IN event', e);
    this.element.selectionStart = 0;
    this.element.selectionEnd = this.element.value.length;
  }
  /**
   * On dropping something into the input - replace the WHOLE value
   * with this new value
   * @param {e} Drag event
   */
  onDrop(e) {
    console.debug('Drop event', e);
    switch (this._dragState) {
      case DRAG_STATES.INTERNAL:
        // This case is handled by the 'onInput' function
        break;
      case DRAG_STATES.EXTERNAL:
        const val = helpers.parseString(e.dataTransfer.getData('text'), this.options);
        this.setValue(val, true);
        e.preventDefault();
        break;
      default:
        // Do nothing;
        break;
    }
  }

  /**
   * On start of ANY drag on page
   * @param {e} Drag event
   */
  onDragstart(e) {
    this._dragState = (e.target === this.element)
      ? DRAG_STATES.INTERNAL
      : DRAG_STATES.EXTERNAL;
    console.debug('Drag STARTED', this._dragState, e);
  }
  /**
   * On end of ANY drag on page
   * @param {e} Drag event
   */
  onDragend(e) {
    console.debug('Drag ENDED', this._dragState, e);
    this._dragState = DRAG_STATES.NONE;
  }
  /**
   * On pasting something into the input
   * @param {e} Clipboard event
   */
  onPaste(e) {
    const val = helpers.parseString(e.clipboardData.getData('text'), this.options);
    this.setValue(val, true);
    e.preventDefault();
  }
  /**
   * On pressing any key inside the input
   * @param {e} Keyboard event
   */
  onKeydown(e) {
    const keyInfo = {
      event: e,
      code: e.which || e.keyCode,
      keyName: keycode(e) ? keycode(e).replace('numpad ', '') : null,
      caretStart: this.element.selectionStart,
      caretEnd: this.element.selectionEnd,
      currentValue: this.element.value,
      newValue: this.element.value
    }

    const actionType = this.getActionType(keyInfo.keyName, e);

    console.debug(actionType);

    switch (actionType) {
      case ACTION_TYPES.NUMBER:
        keyHandlers.onNumber(keyInfo, this.options);
        break;
      case ACTION_TYPES.DECIMAL:
        keyHandlers.onDecimal(keyInfo, this.options);
        break;
      case ACTION_TYPES.MINUS:
        keyHandlers.onMinus(keyInfo, this.options);
        break;
      case ACTION_TYPES.SHORTCUT:
        keyHandlers.onShortcut(keyInfo, this.options);
        break;
      case ACTION_TYPES.HORIZONTAL_ARROW:
      case ACTION_TYPES.VERTICAL_ARROW:
      case ACTION_TYPES.HOME:
      case ACTION_TYPES.END:
        console.debug(actionType);
        // Default behaviour
        return;
      case ACTION_TYPES.BACKSPACE:
        keyHandlers.onBackspace(keyInfo, this.options.thousands);
        break;
      case ACTION_TYPES.DELETE:
        keyHandlers.onDelete(keyInfo, this.options.thousands);
        break;
      case ACTION_TYPES.UNDO:
        keyHandlers.onUndo(this, e);
        return;
      case ACTION_TYPES.REDO:
        keyHandlers.onRedo(this, e);
        return;
      default:
        // If ctrl key modifier is pressed then allow specific event handler
        // to handle this
        if (!e.ctrlKey) {
          e.preventDefault();
        }
        return;
    }

    const newValue = helpers.partialFormat(keyInfo.newValue, this.options);
    const currentValue = keyInfo.newValue;

    this.element.value = newValue;
    this.element.rawValue = this.getRawValue(this.element.value);

    const offset = helpers.calculateOffset(
      currentValue,
      this.element.value,
      keyInfo.caretStart,
      this.options
    );
    const newCaretPos = keyInfo.caretStart + offset;
    this.element.setSelectionRange(newCaretPos, newCaretPos);
    this._history.addValue(newValue);
  }
  /**
   * Backup event if input changes for any other reason, just format value
   * @param {e} Event
   */
  onInput(e) {
    console.debug('on INPUT', e);
    this.setValue(this.element.value);
  }

  /**
   * Removes all listeners from the input
   */
  removeListeners() {
    for (let e in this._listeners) {
      this._listeners[e].element.removeEventListener(e, this._listeners[e].handler);
    }
  }
}

// Factory function
export default function(element, options) {

  if (!element) {
    throw 'Input element must be supplied as first argument';
  }

  const input = new Finput(element, options || {});

  return () => {
    input.removeListeners();
  }
};
