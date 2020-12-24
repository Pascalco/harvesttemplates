import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import _ from 'lodash';
import Harvester from './Harvester';
import {capitalizeFirstLetter} from '../util';
import queryString from 'query-string';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      siteid: 'en',
      project: 'wikipedia',
      namespace: 0,
      p: 1,
      template: '',
      templateredirects: [],
      parameters: [''],
      limityear: 1926,
      rel: 'geq',
      decimalmark: '.',
      category: '',
      depth: 1,
      manuallist: '',
      alreadyset: true,
      wikisyntax: true,
      errors: [],
      allowedunits: [],
      constraints: {},
      addprefix: '',
      addsuffix: '',
      removeprefix: '',
      removesuffix: '',
      searchvalue: '',
      replacevalue: '',
      calendar: 'Q1985727',
      ready: {
        siteinfo: false,
        pages: false,
        templateredirects: false,
        categorymembers: true,
        propertyinfo: false,
        constraints: false,
        itemswithproperty: false,
        buttonPressed: false
      }
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.loadSiteinfo = this.loadSiteinfo.bind(this);
    this.loadPages = this.loadPages.bind(this);
    this.loadTemplateredirects = this.loadTemplateredirects.bind(this);
    this.loadCategorymembers = this.loadCategorymembers.bind(this);
    this.loadPropertyinfo = this.loadPropertyinfo.bind(this);
    this.loadItemsWithProperty = this.loadItemsWithProperty.bind(this);
    this.loadConstraints = this.loadConstraints.bind(this);
    this.loadUnits = this.loadUnits.bind(this);
    this.markError = this.markError.bind(this);
    this.addAlias = this.addAlias.bind(this);
    this.markReady = this.markReady.bind(this);
    this.markUnready = this.markUnready.bind(this);
    this.prepareHarvester = this.prepareHarvester.bind(this);
    this.preloadForm = this.preloadForm.bind(this);
    this.oldVals = {p: 1};
    this.candidates = [];
    this.categorymembers = [];
    this.itemswithproperty = [];
    this.job = {};
    this.tokenC = axios.CancelToken.source();
    this.tokenP = axios.CancelToken.source();
    this.tokenS = axios.CancelToken.source();
    this.tokenT = axios.CancelToken.source();
  }

  preloadForm(params, load){
    let stringvariables = ['siteid', 'project', 'namespace', 'template', 'addprefix', 'removeprefix', 'addsuffix', 'removesuffix', 'searchvalue', 'replacevalue', 'category', 'depth', 'calendar', 'limityear', 'rel', 'unit', 'decimalmark', 'manuallist'];
    let arrayvariables = ['parameters', 'templateredirects'];
    let booleanvariables = ['wikisyntax', 'alreadyset'];
    let update = {}
    for (let [key, value] of Object.entries(params)) {
      if (key === 'p'){
        update[key] = value.replace('P', '');
      } else if (key === 'constraints'){
        update.constraint_temp = value.split('|');
      } else if (key === 'templateredirects'){
        update.templateredirects_temp = value.split('|');
      } else if (booleanvariables.includes(key)){
        update[key] = (value === '1');
      } else if (stringvariables.includes(key)){
        update[key] = value;
      } else if (arrayvariables.includes(key)){
        update[key] = value.split('|');
      }
    }
    this.setState(update, () => {
      this.handleFocus();
      if (load){
        this.markReady('buttonPressed');
      }
    });
  }


  componentDidMount(){
    let params = queryString.parse(window.location.search);
    if (Object.keys(params).length > 0){
      if ('htid' in params){
        this.job.htid = params.htid;
        axios.get('https://pltools.toolforge.org/harvesttemplates/gethtshare.php', {
          params
        })
        .then(response => {
          this.preloadForm(response.data, true);
        }).catch(error => {
          console.log(error);
        });
      } else {
        this.preloadForm(params, false);
      }
    }
  }

  prepareHarvester(){
    let fcandidates = _.differenceBy(this.candidates, this.itemswithproperty, 'qid');
    if (this.categorymembers.length > 0){
      fcandidates = fcandidates.filter(c => this.categorymembers.includes(c.title));
    }
    if (this.state.manuallist !== ''){
      let manuallist = this.state.manuallist.split('\n').map(e => e.replace(/_/g, ' ').trim());
      let fcandidates1 = fcandidates.filter(c => manuallist.includes(c.title));
      let fcandidates2 = fcandidates.filter(c => manuallist.includes(c.qid));
      fcandidates = fcandidates1.concat(fcandidates2);
      this.job.manuallist = this.state.manuallist;
    }
    fcandidates.sort((a, b) => a.timestamp - b.timestamp);
    this.job.editgroup = Math.floor(Math.random() * Math.pow(2, 48)).toString(16);
    this.job.addprefix = this.state.addprefix;
    this.job.removeprefix = this.state.removeprefix;
    this.job.addsuffix = this.state.addsuffix;
    this.job.removesuffix = this.state.removesuffix;
    this.job.searchvalue = this.state.searchvalue;
    this.job.replacevalue = this.state.replacevalue;
    this.job.namespace = this.state.namespace;
    this.job.template = capitalizeFirstLetter(this.state.template).replace(/_/g, ' ');
    this.job.parameters = this.state.parameters;
    this.job.calendar = this.state.calendar;
    this.job.limityear = this.state.limityear;
    this.job.rel = this.state.rel;
    this.job.siteid = this.state.siteid;
    this.job.project = this.state.project;
    this.job.unit = this.state.unit;
    this.job.decimalmark = this.state.decimalmark;
    this.job.category = this.state.category;
    this.job.depth = this.state.depth;
    this.job.alreadyset = this.state.alreadyset;
    this.job.wikisyntax = this.state.wikisyntax;
    this.job.constraints = [];
    for(let c of Object.values(this.state.constraints)){
      if (c.value === true){
        this.job.constraints.push(c.qid)
      }
    }
    this.job.templateredirects = [];
    for(let c of Object.values(this.state.templateredirects)){
      if (c.value === true){
        this.job.templateredirects.push(c.title)
      }
    }

    ReactDOM.render(
      <Harvester candidates={fcandidates} job={this.job}/>,
      document.getElementById('harvester')
    )

    this.markUnready('buttonPressed');
  }

  markReady(value){
      let ready = this.state.ready;
      ready[value] = true;
      this.setState({
         ready: ready
      });
      for (let val of Object.values(this.state.ready)){
          if (val === false){
              return(0);
          }
      }
      this.prepareHarvester();
  }

  markUnready(value){
    let ready = this.state.ready;
    ready[value] = false;
    this.setState({
       ready: ready
    });
  }

  markError(field) {
    this.markUnready('buttonPressed');
    let newerrors = this.state.errors;
    newerrors.push(field);
    this.setState({
      errors: newerrors
    });
  }

  loadItemsWithProperty() {
    let data = {
      query: `SELECT ?item { ?item wdt:P${this.state.p} [] }`, //better but slower: p/ps
      format: 'json',
    };
    axios.get('https://query.wikidata.org/bigdata/namespace/wdq/sparql?', {
      params: data,
    })
    .then(response => {
      this.itemswithproperty = response.data.results.bindings.map(x => ({qid: x.item.value.replace('http://www.wikidata.org/entity/', '')}));
      this.markReady('itemswithproperty');
    }).catch(error => {
      console.log('error loadItemsWithProperty', error, data.query);
      if (!(axios.isCancel(error))) {
        this.markError('alreadyset');
      }
    });
  }

  loadUnits(allowedunits_id){
    let allowedunits = [];
    if (allowedunits_id.length > 0) {
      if (allowedunits_id.includes("1")){
        allowedunits.push(<option value={1} key="novalue">no value</option>);
        allowedunits_id = allowedunits_id.filter(item => item !== "1")
      }
      let unit = '1';
      let data = {
        action: 'wbgetentities',
        ids: allowedunits_id.join('|'),
        props: 'labels',
        languages: 'en',
        format: 'json',
        origin: '*'
      }
      axios.get('https://www.wikidata.org/w/api.php', {
        params: data,
        cancelToken: this.tokenP.token
      })
      .then(response => {
        if ('entities' in response.data) {
          for (let q of Object.values(response.data.entities)) {
            if (unit === '1'){
              unit = q.id;
            }
            if ('en' in q.labels) {
              allowedunits.push(<option value={q.id} key={q.id}>{q.labels.en.value}</option>);
            } else {
              allowedunits.push(<option value={q.id} key={q.id}>{q.id}</option>);
            }
          }
        }
        this.setState({
          allowedunits: allowedunits
        });
        if (this.state.unit === undefined){
          this.setState({
            unit: unit
          });
        }
        this.markReady('propertyinfo');
      }).catch(error => {
        console.log(error);
      });
    } else {
      toast.error(<span>allowed unit constraint on property page missing</span>, {position: toast.POSITION.TOP_CENTER});
      this.markError('property');
    }
  }

  loadConstraints(constraints_id, constraints_mandatory_id){
    let constraints = {};
    let data = {
      action: 'wbgetentities',
      ids: constraints_id.concat(constraints_mandatory_id).join('|'),
      props: 'labels',
      languages: 'en',
      format: 'json',
      origin: '*'
    }
    axios.get('https://www.wikidata.org/w/api.php', {
      params: data,
      cancelToken: this.tokenP.token
    })
    .then((response) => {
      if ('entities' in response.data) {
        for (let q of Object.values(response.data.entities)) {
          let label = q.id;
          if ('en' in q.labels) {
           label = q.labels.en.value;
          }
          if (constraints_mandatory_id.includes(q.id)){
            constraints[q.id] = {qid: q.id, label: label, disabled: true, value: true};
          } else if (this.state.constraint_temp) {
            constraints[q.id] = {qid: q.id, label: label, disabled: false, value: this.state.constraint_temp.includes(q.id)}
          } else {
            constraints[q.id] = {qid: q.id, label: label, disabled: false, value: true}
          }
        }
      }
      this.setState({
        constraints: constraints
      });
      this.markReady('constraints');
    }).catch(error => {
      console.log(error);
    });

  }

  loadPropertyinfo() {
    this.job.p = `P${this.state.p}`;
    let data = {
      action: 'wbgetentities',
      ids: this.job.p,
      props: 'claims|datatype|labels',
      languages: 'en',
      format: 'json',
      origin: '*'
    }
    axios.get('https://www.wikidata.org/w/api.php', {
      params: data,
      cancelToken: this.tokenP.token
    })
    .then(response => {
      if (!('missing' in response.data.entities[this.job.p])) {
        if ('P31' in response.data.entities[this.job.p].claims) {
          for (let claim of response.data.entities[this.job.p].claims.P31) {
            let instance = claim.mainsnak.datavalue.value.id;
            if (instance === 'Q37911748' || instance === 'Q18644427') {
              toast.error(<span>Property is deprecated</span>, {position: toast.POSITION.TOP_CENTER});
              this.markError('property');
              return 0;
            }
          }
        }
        this.job.datatype = response.data.entities[this.job.p].datatype;
        const supportedDatatypes = ['quantity', 'time', 'wikibase-item', 'url', 'string', 'external-id', 'commonsMedia'];
        if (!(supportedDatatypes.includes(this.job.datatype))){
           toast.error(<span>not supported datatype: {this.job.datatype}</span>, {position: toast.POSITION.TOP_CENTER});
           this.markError('property');
           return 0;
        }

        let label = ('en' in response.data.entities[this.job.p].labels) ? response.data.entities[this.job.p].labels.en.value : this.job.p;
        let propinfofield = <a href={"https://www.wikidata.org/wiki/Property:"+ this.job.p} target="_blank" rel="noopener noreferrer">{label}</a>;
        this.setState({
          propinfofield: propinfofield,
          datatype: this.job.datatype
        });
        let allowedunits_id = [];
        let constraints_id = [];
        let constraints_mandatory_id = [];
        if ('P2302' in response.data.entities[this.job.p].claims) {
          for (let claim of response.data.entities[this.job.p].claims.P2302) {
            if (claim.mainsnak.datavalue.value.id === 'Q21514353') {
              for (let c of claim.qualifiers.P2305) {
                if (c.snaktype === 'novalue') {
                  allowedunits_id.push("1");
                } else if (c.snaktype === 'value') {
                  allowedunits_id.push(c.datavalue.value.id);
                }
              }
            }
            let cstatus = 'normal';
            if ('qualifiers' in claim && 'P2316' in claim.qualifiers) {
              for (let c of claim.qualifiers.P2316) {
                if (c.datavalue.value.id === 'Q21502408') {
                  cstatus = 'mandatory';
                } else if (c.datavalue.value.id === 'Q62026391') {
                  cstatus = 'suggestion';
                }
              }
            }
            if (cstatus === 'mandatory') {
              constraints_mandatory_id.push(claim.mainsnak.datavalue.value.id);
            } else if (cstatus === 'normal') {
              constraints_id.push(claim.mainsnak.datavalue.value.id);
            }
          }
        }
        this.loadConstraints(constraints_id, constraints_mandatory_id);

        if (response.data.entities[this.job.p].datatype === 'quantity'){
          this.loadUnits(allowedunits_id);
        } else {
          this.markReady('propertyinfo');
        }

      } else {
        this.markError('property');
      }

    }).catch(error => {
      if (!(axios.isCancel(error))) {
        console.log(error);
      }
    });
  }

  loadCategorymembers(categories) {
    let promises = [];
    let newcategories = [];
    for (let category of categories) {
      let data = {
        action: 'query',
        list: 'categorymembers',
        cmlimit: 'max',
        cmtitle: category[0],
        cmcontinue: category[1],
        _depth: category[2],
        format: 'json',
        origin: '*'
      }
      promises.push(axios.get(`${this.job.site}/w/api.php`, {
          params: data,
          cancelToken: this.tokenC.token
        }));
    }
    axios.all(promises).then(results => {
      for (let result of results) {
        let depth = result.config.params._depth;
        if ('query' in result.data) {
          for (let val of result.data.query.categorymembers) {
            if (val.ns === 14 && depth < this.state.depth) {
              newcategories.push([val.title, '', depth + 1]);
            }
            if (val.ns === parseInt(this.state.namespace)) {
              this.categorymembers.push(val.title);
            }
          };
          if ('continue' in result.data) {
            let cont = result.data.continue.cmcontinue;
            newcategories.push([result.config.params.cmtitle, cont, depth]);
          }
        }
      }
      if (newcategories.length > 0) {
        this.loadCategorymembers(newcategories);
      } else {
        this.markReady('categorymembers');
      }
    });
  }

  loadTemplateredirects() {
    let templateredirects = {};
    let data = {
      action: 'query',
      prop: 'redirects',
      titles: `Template:${this.state.template}`,
      rdnamespace: 10,
      rdlimit: 'max',
      format: 'json',
      origin: '*'
    }
    axios.get(`${this.job.site}/w/api.php`, {
      params: data,
      cancelToken: this.tokenT.token
    })
    .then(response => {
      for (let pa of Object.values(response.data.query.pages)) {
        if ('redirects' in pa) {
          for (let val of pa.redirects) {
            val.title = val.title.split(':')[1];
            if (this.state.templateredirects_temp){
              templateredirects[val.pageid] = {title: val.title, value: this.state.templateredirects_temp.includes(val.title), pageid: val.pageid};
            } else {
              templateredirects[val.pageid] = {title: val.title, value: true, pageid: val.pageid};
            }
          }
        }
      }
      this.setState({
          templateredirects: templateredirects
      });
      this.markReady('templateredirects');
    }).catch(error => {
      if (!(axios.isCancel(error))) {
        console.log(error);
        this.markError('template');
      }
    });
  }

  loadPages(cont = 0) {
    let templateinfofield;
    if (this.state.template !== ''){
      templateinfofield = <a href={`https://${this.state.siteid}.${this.state.project}.org/wiki/Template:${this.state.template}`} target="_blank" rel="noopener noreferrer">link</a>;
    } else {
      templateinfofield = '';
    }
    this.setState({
      templateinfofield: templateinfofield
    });
    let data = {
      action: 'query',
      generator: 'transcludedin',
      titles: `Template:${this.state.template}`,
      gtilimit: 'max',
      gtinamespace: this.state.namespace,
      prop: 'pageprops|revisions',
      rvprop: 'timestamp',
      ppprop: 'wikibase_item',
      gticontinue: cont,
      format: 'json',
      origin: '*'
    }
    axios.get(`${this.job.site}/w/api.php`, {
      params: data,
      cancelToken: this.tokenT.token
    })
    .then(response => {
      if ('query' in response.data) {
        for (let val of Object.values(response.data.query.pages)) {
          if ('pageprops' in val && 'wikibase_item' in val.pageprops) {
            this.candidates.push({
              pageid: val.pageid,
              title: val.title,
              qid: val.pageprops.wikibase_item,
              lastedit: val.revisions[0].timestamp
            });
          } else {
            this.candidates.push({
              pageid: val.pageid,
              title: val.title,
              lastedit: val.revisions[0].timestamp
            });
          }
        };
        if ('continue' in response.data) {
          let cont = response.data.continue.gticontinue;
          this.loadPages(cont);
        } else {
          this.markReady('pages');
        }
      }
    }).catch(error => {
      if (!(axios.isCancel(error))) {
        console.log(error);
        this.markError('template');
      }
    });
  }

  loadSiteinfo() {
    this.job.site = `https://${this.state.siteid}.${this.state.project}.org`;
    let data = {
      action: 'query',
      meta: 'siteinfo',
      siprop: 'general|namespaces|namespacealiases',
      format: 'json',
      origin: '*'
    }
    axios.get(`${this.job.site}/w/api.php`, {
      params: data,
      cancelToken: this.tokenS.token
    })
    .then(response => {
      this.job.lang = response.data.query.general.lang;
      this.job.dbname = response.data.query.general.wikiid;
      let data = {
        query: `SELECT ?wiki { ?wiki wdt:P1800 '${this.job.dbname}'}`,
        format: 'json',
      };
      axios.get('https://query.wikidata.org/bigdata/namespace/wdq/sparql?', {
        params: data,
      })
      .then(response => {
        if (response.data.results.bindings.length > 0) {
          this.job.wbeditionid = response.data.results.bindings[0].wiki.value.replace('http://www.wikidata.org/entity/', '');
          this.markReady('siteinfo');
        } else {
          this.markError('siteid');
          this.markError('project');
        }
      })
      .catch((error) => console.error(error));

      let namespaces = {};
      for (var ns in response.data.query.namespaces) {
        namespaces[ns] = response.data.query.namespaces[ns]['*'];
      }
      this.job.fileprefixes = ['File', namespaces[6]];
      this.job.templateprefixes = ['Template', namespaces[10]];
      for (let i in response.data.query.namespacealiases) {
        if (response.data.query.namespacealiases[i].id === 6) {
          this.job.fileprefixes.push(response.data.query.namespacealiases[i]['*']);
        } else if (response.data.query.namespacealiases[i].id === 10) {
          this.job.templateprefixes.push(response.data.query.namespacealiases[i]['*']);
        }
      }
    })
    .catch(error => {
      if (!(axios.isCancel(error))) {
        this.markError('siteid');
        this.markError('project');
      }
    });

  }

  addAlias(event){
    event.preventDefault();
    let newparameters = this.state.parameters;
    newparameters.push('');
    this.setState({
        parameters: newparameters
    });
  }

  handleSubmit(event){
    event.preventDefault();
    this.handleFocus();
    this.job.htid = undefined;
    if (this.state.parameters[0] === '' && this.state.aparameter1 === ''){
      this.markError('parameters');
    } else if (this.state.template === ''){
      this.markError('template');
    } else if (this.state.siteid === ''){
      this.markError('siteid');
    } else if (this.state.p === 1){
      this.markError('property');
    } else {
      ReactDOM.render(
        <div />,
        document.getElementById('harvester')
      )
      setTimeout(() => {
        this.markReady('buttonPressed');
      }, 1000);
    }
  }

  handleInputChange(event) {
    this.markUnready('buttonPressed');
    const target = event.target;
    const name = target.name;
    let value;
    if (name === 'parameters'){
      value = this.state.parameters;
      value[target.getAttribute('listid')] = target.value;
    } else if (name === 'templateredirects'){
      value = this.state.templateredirects;
      value[target.getAttribute('listid')].value = target.checked;
    } else if (name === 'constraints'){
      value = this.state.constraints;
      value[target.getAttribute('listid')].value = target.checked;
    } else if (target.type === 'checkbox') {
      value = target.checked;
    } else {
      value = target.value;
    }
    let newerrors = this.state.errors.filter(e => e !== name);
    if (name === 'siteid') {
      newerrors = newerrors.filter(e => e !== 'project');
    } else if (name === 'project') {
      newerrors = newerrors.filter(e => e !== 'siteid');
    }
    this.setState({
      [name]: value,
      errors: newerrors
    });
  }

  handleFocus() {
    if (this.oldVals.siteid !== this.state.siteid || this.oldVals.project !== this.state.project) {
      this.oldVals.siteid = this.state.siteid;
      this.oldVals.project = this.state.project;
      this.oldVals.template = ''; //triggers loadPages()
      this.oldVals.category = ''; //triggers loadCategorymembers()
      this.tokenS.cancel('Operation canceled due to input changes');
      this.tokenS = axios.CancelToken.source();
      this.markUnready('siteinfo');
      this.loadSiteinfo();
    }
    if (this.oldVals.template !== this.state.template || this.oldVals.namespace !== this.state.namespace) {
      this.candidates = [];
      this.oldVals.template = this.state.template;
      this.oldVals.namespace = this.state.namespace;
      this.tokenT.cancel('Operation canceled due to input changes');
      this.tokenT = axios.CancelToken.source();
      this.markUnready('pages');
      this.markUnready('templateredirects');
      this.loadPages();
      this.loadTemplateredirects();
    }
    if (this.oldVals.p !== this.state.p || this.oldVals.alreadyset !== this.state.alreadyset) {
      this.itemswithproperty = [];
      this.tokenP.cancel('Operation canceled due to input changes');
      this.tokenP = axios.CancelToken.source();
      this.oldVals.alreadyset = this.state.alreadyset;
      if (this.oldVals.p !== this.state.p) {
        this.oldVals.p = this.state.p;
        this.markUnready('constraints');
        this.markUnready('propertyinfo');
        this.loadPropertyinfo();
      }
      if (this.state.alreadyset === true) {
        this.markUnready('itemswithproperty');
        this.loadItemsWithProperty();
      } else {
        this.markReady('itemswithproperty');
      }
    }
    if (this.oldVals.category !== this.state.category || this.oldVals.depth !== this.state.depth) {
      this.categorymembers = [];
      this.oldVals.category = this.state.category;
      this.oldVals.depth = this.state.depth;
      this.tokenC.cancel('Operation canceled due to input changes');
      this.tokenC = axios.CancelToken.source();
      if (this.state.category.length > 0) {
        this.markUnready('categorymembers');
        this.loadCategorymembers([[`Category:${this.state.category}`, '', 0]]);
      }
    }
  }

  render() {
    let standardfield = [];
    for(let i=0; i<this.state.parameters.length; i+=1){
      standardfield.push(<input name='parameters' key={i} listid={i} type="text" value={this.state.parameters[i]} onChange={this.handleInputChange} onFocus={this.handleFocus} className={this.state.errors.includes('parameters') ? 'inputerror' : ''}/>);
    }
    let mainfield = <div>{standardfield}<br /><button onClick={this.addAlias} className="formButton">+ add alias</button></div>
    let parameterfields;
    switch (this.state.datatype) {
      case 'wikibase-item':
        parameterfields = <div>{mainfield}<input type="checkbox" name="wikisyntax" checked={this.state.wikisyntax} onChange={this.handleInputChange} onFocus={this.handleFocus} />try to match target page even without wikisyntax</div>;
        break;
      case 'time':
        parameterfields = <div>{mainfield}or<br />
        <input type="text" name="year" className="shorter30" value={this.state.aparameter1} onChange={this.handleInputChange} onFocus={this.handleFocus} /> year<br />
        <input type="text" name="month" className="shorter30" value={this.state.aparameter2} onChange={this.handleInputChange} onFocus={this.handleFocus} /> month<br />
        <input type="text" name="day" className="shorter30" value={this.state.aparameter3} onChange={this.handleInputChange} onFocus={this.handleFocus}  /> day<br />
        <select name="calendar" value={this.state.calendar} onChange={this.handleInputChange} onFocus={this.handleFocus} >
          <option value="Q1985727">Gregorian</option>
          <option value="Q1985786">Julian</option>
        </select> if year
        <select name="rel" value={this.state.rel} onChange={this.handleInputChange} onFocus={this.handleFocus} className="shorter30" >
          <option value="geq">&#61;&#62;</option>
          <option value="l">&#60;</option>
        </select>
        <input type="number" name="limityear" min="1" value={this.state.limityear} onChange={this.handleInputChange} onFocus={this.handleFocus} /></div>
        break;
      case 'quantity':
        parameterfields = <div>{mainfield}<br />
        unit: <select name="unit" value={this.state.unit} onFocus={this.handleFocus} onChange={this.handleInputChange}>{this.state.allowedunits}</select><br />
                 decimal mark
                 <select name="decimalmark" value={this.state.decimalmark} onFocus={this.handleFocus} onChange={this.handleInputChange}>
                   <option>.</option>
                   <option>,</option>
                 </select>
                 </div>;
        break;
      default:
        parameterfields = mainfield;
    }

    let constraintfield;
    if (Object.values(this.state.constraints).length > 0){
      let constraintboxes = [];
      for (let c of Object.values(this.state.constraints)){
        constraintboxes.push(<div key={c.qid} className="row"><div className="col2"><input type="checkbox" checked={c.value} key={c.qid} name='constraints' listid={c.qid} onChange={this.handleInputChange} onFocus={this.handleFocus} disabled={c.disabled} />{c.label}</div></div>);
      }
      constraintfield = <div><h2>Check quality</h2>{constraintboxes}</div>;
    }
    let templateredirectfield;
    if (Object.values(this.state.templateredirects).length > 0){
      let templateredirectboxes = [];
      for (let c of Object.values(this.state.templateredirects)){
        templateredirectboxes.push(<div key={c.pageid}><input type="checkbox" checked={c.value} key={c.pageid} name='templateredirects' listid={c.pageid} onChange={this.handleInputChange} onFocus={this.handleFocus} />{c.title}</div>);
      }
      templateredirectfield = <div className="row"><div className="col1">include</div><div className="col2">{templateredirectboxes}</div></div>;
   }

    return (
      <div><ToastContainer /><form><div className="flex-container">
        <div className="flexItem">
          <h2>Load pages from</h2>
          <div className="row">
            <div className="col1">Wiki</div>
            <div className="col2">
              <input name="siteid" type="text" value={this.state.siteid} onChange={this.handleInputChange} onFocus={this.handleFocus} className={`shorter30 ${this.state.errors.includes('siteid') ? 'inputerror' : ''}`} />.
                <select name="project" value={this.state.project} onFocus={this.handleFocus} onChange={this.handleInputChange} className={`shorter55 ${this.state.errors.includes('project') ? 'inputerror' : ''}`} >
                <option value = "wikipedia"> wikipedia </option>
                <option value = "wikibooks"> wikibooks </option>
                <option value = "wikinews"> wikinews </option>
                <option value = "wikiquote"> wikiquote </option>
                <option value = "wikisource"> wikisource </option>
                <option value = "wikiversity"> wikiversity </option>
                <option value = "wikivoyage"> wikivoyage </option>
                <option value = "wiktionary"> wiktionary </option>
                <option value = "commons"> commons </option>
                </select>.org
            </div>
          </div>

          <div className="row">
            <div className="col1">Namespace</div>
            <div className="col2">
              <input name="namespace" type="number" value={this.state.namespace} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <br /><h2>Define import</h2>

          <div className="row">
            <div className="col1">Property</div>
            <div className="col2">
              <input name="p" type="number" value={this.state.p} onChange={this.handleInputChange} onFocus={this.handleFocus} className={this.state.errors.includes('property') ? 'inputerror' : ''} />
              <span>{this.state.propinfofield}</span>
            </div>
          </div>

          <div className="row">
            <div className="col1">Template</div>
            <div className="col2">
              <input name="template" type="text" value={this.state.template} onChange={this.handleInputChange} onFocus={this.handleFocus} className={this.state.errors.includes('template') ? 'inputerror' : ''} />
              <span>{this.state.templateinfofield}</span>
            </div>
          </div>

          {templateredirectfield}

          <div className="row">
            <div className="col1">Parameter</div>
            <div className="col2">{parameterfields}</div>
          </div>
        </div>

        <div className="flexItem">
          <h2>Modify values</h2>
          <div className="row">
            <div className="col1">add prefix</div>
            <div className="col2">
              <input type="text" name="addprefix" value={this.state.addprefix} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">remove prefix</div>
            <div className="col2">
              <input type="text" name="removeprefix" value={this.state.removeprefix} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">add suffix</div>
            <div className="col2">
              <input type="text" name="addsuffix" value={this.state.addsuffix} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">remove suffix</div>
            <div className="col2">
              <input type="text" name="removesuffix" value={this.state.removesuffix}  onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">regex search value</div>
            <div className="col2">
              <input type="text" name="searchvalue" value={this.state.searchvalue} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">regex replace value</div>
            <div className="col2">
              <input type="text" name="replacevalue" value={this.state.replacevalue}  onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>
        </div>

        <div className="flexItem">
          <h2>Filter</h2>
          <div className="row">
            <div className="col1">Category</div>
            <div className="col2">
              <input name="category" type="text" value={this.state.category} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">Category depth</div>
            <div className="col2">
              <input name="depth" type="number" value={this.state.depth} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col1">Manual list</div>
            <div className="col2">
              <textarea name="manuallist" value={this.state.manuallist} onChange={this.handleInputChange} onFocus={this.handleFocus} />
            </div>
          </div>

          <div className="row">
            <div className="col2">
              <input type="checkbox" name="alreadyset" checked={this.state.alreadyset} onChange={this.handleInputChange} onFocus={this.handleFocus} className={this.state.errors.includes('alreadyset') ? 'inputerror' : ''} />  do not load items with property set
            </div>
          </div>
        </div>

        <div className="flexItem">{constraintfield}</div>

      </div>
      <div className="formFooter">
        <button onClick={this.handleSubmit} id="submitButton" className={`linkButton ${this.state.ready.buttonPressed ? 'deactivated' : ''}`}>{this.state.ready.buttonPressed ? 'loading...' : 'load'}</button>
      </div>

      </form>
      </div>
    );
  }
}

export default Form

