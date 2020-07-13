import React from 'react';
import axios from 'axios';
import Cookies from 'universal-cookie';
import {backend} from '../util.js';

class Start extends React.Component {
    constructor(props) {
      super(props);
      this.onLogin = this.onLogin.bind(this);
      this.onLinkClick = this.onLinkClick.bind(this);
      this.state = {
        username: 0
      }
    }
    
    onLogin(){
      if (this.state.username === 0){
        window.location.href = `${backend}authorize?landingpage=https://pltools.toolforge.org/harvesttemplates/landingpage.php`;
      } else {
        const cookies = new Cookies();
        window.location.href = `${backend}logout?token=${cookies.get('plnodeJwt')}`;
      }        
    }
    
    onLinkClick(event){  
      let url = event.target.getAttribute('url');
      if (url){
        window.location.href = url;
      }
    }      
    
    componentDidMount(){
      const cookies = new Cookies();
      axios.get(`${backend}profile`, {
        params : {
          token: cookies.get('plnodeJwt')
        }
      })
      .then(response => {
        this.setState({
          username: response.data.username
        });
      })
      .catch(error => {
         console.log(error);
         this.setState({
           username: 0
         });
      })
    }
    
    render(){
        return(
          <span>
            <h1>Harvest Templates</h1>
            <span>Tool to tranfer data from Wikimedia projects to Wikidata</span>
            <br />
            <button className="linkButton" onClick={this.onLogin}>{`${this.state.username === 0 ? 'Login' : 'Logout as '+this.state.username}`}</button>
            <button className="linkButton" onClick={this.onLinkClick} url={'share.php'}>predefined queries</button>
            <button className="linkButton deactivated" onClick={this.onLinkClick} url={''}>help</button>
            <button className="linkButton" onClick={this.onLinkClick} url={'https://www.wikidata.org/wiki/User_talk:Pasleim'}>contact</button>
            <button className="linkButton deactivated" onClick={this.onLinkClick} url={''}>code</button>
            
          </span>
          )
    }
    
}

export default Start