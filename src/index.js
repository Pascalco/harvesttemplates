import React from 'react';
import ReactDOM from 'react-dom';
import Form from './components/Form';
import Start from './components/Start';

import './style.css';

ReactDOM.render(
    <Start />,
  document.getElementById('start')
);

ReactDOM.render(
    <Form />,
  document.getElementById('form')
);
