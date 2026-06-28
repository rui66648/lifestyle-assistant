(function() {
  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};
  if (!App.UI.Components) App.UI.Components = {};

  App.UI.Components.Button = {
    create(options) {
      const opts = Object.assign({
        text: '按钮',
        variant: 'primary',
        size: 'md',
        icon: '',
        onClick: null,
        className: '',
        disabled: false
      }, options);

      const btn = document.createElement('button');
      btn.className = `ui-btn ui-btn--${opts.variant} ui-btn--${opts.size} ${opts.className}`;
      if (opts.disabled) btn.disabled = true;

      if (opts.icon) {
        btn.innerHTML = `<span class="ui-btn__icon">${opts.icon}</span><span class="ui-btn__text">${opts.text}</span>`;
      } else {
        btn.textContent = opts.text;
      }

      if (opts.onClick) {
        btn.addEventListener('click', opts.onClick);
      }

      return btn;
    }
  };

  App.UI.Components.Switch = {
    create(options) {
      const opts = Object.assign({
        checked: false,
        onChange: null,
        label: '',
        className: ''
      }, options);

      const container = document.createElement('label');
      container.className = `ui-switch ${opts.className}`;
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'ui-switch__input';
      if (opts.checked) input.checked = true;

      const slider = document.createElement('span');
      slider.className = 'ui-switch__slider';

      if (opts.label) {
        const labelText = document.createElement('span');
        labelText.className = 'ui-switch__label';
        labelText.textContent = opts.label;
        container.appendChild(labelText);
      }

      container.appendChild(input);
      container.appendChild(slider);

      if (opts.onChange) {
        input.addEventListener('change', (e) => opts.onChange(e.target.checked));
      }

      return container;
    }
  };

  App.UI.Components.Checkbox = {
    create(options) {
      const opts = Object.assign({
        checked: false,
        onChange: null,
        label: '',
        className: ''
      }, options);

      const container = document.createElement('label');
      container.className = `ui-checkbox ${opts.className}`;

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'ui-checkbox__input';
      if (opts.checked) input.checked = true;

      const box = document.createElement('span');
      box.className = 'ui-checkbox__box';

      const check = document.createElement('span');
      check.className = 'ui-checkbox__check';

      box.appendChild(check);

      if (opts.label) {
        const labelText = document.createElement('span');
        labelText.className = 'ui-checkbox__label';
        labelText.textContent = opts.label;
        container.appendChild(labelText);
      }

      container.appendChild(input);
      container.appendChild(box);

      if (opts.onChange) {
        input.addEventListener('change', (e) => opts.onChange(e.target.checked));
      }

      return container;
    }
  };

  App.UI.Components.Card = {
    create(options) {
      const opts = Object.assign({
        title: '',
        content: '',
        icon: '',
        className: '',
        header: null,
        footer: null
      }, options);

      const card = document.createElement('div');
      card.className = `ui-card ${opts.className}`;

      if (opts.header) {
        const header = document.createElement('div');
        header.className = 'ui-card__header';
        header.appendChild(opts.header);
        card.appendChild(header);
      } else if (opts.title || opts.icon) {
        const header = document.createElement('div');
        header.className = 'ui-card__header';
        
        if (opts.icon) {
          const icon = document.createElement('span');
          icon.className = 'ui-card__icon';
          icon.textContent = opts.icon;
          header.appendChild(icon);
        }
        
        if (opts.title) {
          const title = document.createElement('h3');
          title.className = 'ui-card__title';
          title.textContent = opts.title;
          header.appendChild(title);
        }
        
        card.appendChild(header);
      }

      if (opts.content) {
        const body = document.createElement('div');
        body.className = 'ui-card__body';
        if (typeof opts.content === 'string') {
          body.innerHTML = opts.content;
        } else {
          body.appendChild(opts.content);
        }
        card.appendChild(body);
      }

      if (opts.footer) {
        const footer = document.createElement('div');
        footer.className = 'ui-card__footer';
        footer.appendChild(opts.footer);
        card.appendChild(footer);
      }

      return card;
    }
  };

  App.UI.Components.Input = {
    create(options) {
      const opts = Object.assign({
        type: 'text',
        placeholder: '',
        value: '',
        onChange: null,
        className: '',
        label: '',
        icon: ''
      }, options);

      const container = document.createElement('div');
      container.className = `ui-input ${opts.className}`;

      if (opts.label) {
        const label = document.createElement('label');
        label.className = 'ui-input__label';
        label.textContent = opts.label;
        container.appendChild(label);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'ui-input__wrapper';

      if (opts.icon) {
        const icon = document.createElement('span');
        icon.className = 'ui-input__icon';
        icon.textContent = opts.icon;
        wrapper.appendChild(icon);
      }

      const input = document.createElement('input');
      input.type = opts.type;
      input.className = 'ui-input__field';
      input.placeholder = opts.placeholder;
      input.value = opts.value;

      if (opts.onChange) {
        input.addEventListener('input', (e) => opts.onChange(e.target.value));
      }

      wrapper.appendChild(input);
      container.appendChild(wrapper);

      return container;
    }
  };

  App.UI.Components.Badge = {
    create(options) {
      const opts = Object.assign({
        text: '',
        variant: 'default',
        icon: '',
        className: ''
      }, options);

      const badge = document.createElement('span');
      badge.className = `ui-badge ui-badge--${opts.variant} ${opts.className}`;

      if (opts.icon) {
        badge.innerHTML = `<span class="ui-badge__icon">${opts.icon}</span><span class="ui-badge__text">${opts.text}</span>`;
      } else {
        badge.textContent = opts.text;
      }

      return badge;
    }
  };

  if (App.registerModule) {
    App.registerModule('ui.components', 'ui', ['ui.panels', 'ui.render']);
  }
})();