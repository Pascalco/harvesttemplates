import React from "react";
import axios from "axios";
import update from "react-addons-update";
import DataTable from "react-data-table-component";
import Cookies from "universal-cookie";
import { toast } from "react-toastify";
import { backend } from "../util.js";

class Harvester extends React.Component {
  constructor(props) {
    super(props);
    this.runHarvester = this.runHarvester.bind(this);
    this.convertArrayOfObjectsToCSV = this.convertArrayOfObjectsToCSV.bind(this);
    this.handleDownload = this.handleDownload.bind(this);
    this.handleStartStop = this.handleStartStop.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handlePermalink = this.handlePermalink.bind(this);
    this.createLink = this.createLink.bind(this);
    this.onChangeRowsPerPage = this.onChangeRowsPerPage.bind(this);
    this.onLogin = this.onLogin.bind(this);
    this.cancelJob = this.cancelJob.bind(this);
    this.delay = 2000;
    this.run = false;
    this.stoppedAt = 0;
    this.pageNo = 1;
    this.rowsPerPage = 20;
    this.cancelToken = axios.CancelToken.source();
    this.state = {
      data: {},
      jobstatus: "",
    };
    this.counts = { total: 0, success: 0, error: 0 };
    const cookies = new Cookies();
    this.Jwt = cookies.get("plnodeJwt");
  }

  onLogin() {
    window.location.href = `${backend}authorize?landingpage=https://pltools.toolforge.org/harvesttemplates/landingpage.php`;
  }

  runHarvester(i) {
    let timeout = false;
    if (!this.props.candidates[i]) {
      //done
      document.title = "DONE - " + document.title;
      this.setState({
        jobstatus: `done (${this.counts.success + this.counts.error}/${this.counts.total}, successes: ${this.counts.success}, errors: ${
          this.counts.error
        })`,
      });

      if (this.props.job.htid) {
        axios.get("share.php", {
          params: {
            action: "update",
            htid: this.props.job.htid,
          },
        });
      }
      return 1;
    }
    axios
      .post(`${backend}harvester`, {
        data: {
          candidate: JSON.stringify(this.props.candidates[i]),
          job: JSON.stringify(this.props.job),
          token: this.Jwt,
        },
        cancelToken: this.cancelToken.token,
      })
      .then(response => {
        if (response.data.status === "success") {
          this.counts.success += 1;
        } else {
          if (response.data.message === "Server lag") {
            timeout = true;
          } else {
            this.counts.error += 1;
          }
        }
        this.setState({
          candidates: update(this.state.candidates, {
            [i]: {
              parsedvalue: {
                $set: response.data.parsedvalue,
              },
              rawvalue: {
                $set: response.data.rawvalue,
              },
              message: {
                $set: response.data.message,
              },
              status: {
                $set: response.data.status,
              },
            },
          }),
        });
      })
      .catch(error => {
        console.log(error);
        this.counts.error += 1;
        this.setState({
          candidates: update(this.state.candidates, {
            [i]: {
              message: {
                $set: "error",
              },
              status: {
                $set: "error",
              },
            },
          }),
        });
      })
      .finally(() => {
        i += 1;
        if (i % this.rowsPerPage === 0) {
          this.pageNo += 1;
        }

        if (timeout) {
          this.setState({
            jobstatus: `waiting... Server lag (${this.counts.success + this.counts.error}/${this.counts.total}, successes: ${
              this.counts.success
            }, errors: ${this.counts.error})`,
          });
        } else {
          this.setState({
            jobstatus: `doing... (${this.counts.success + this.counts.error}/${this.counts.total}, successes: ${
              this.counts.success
            }, errors: ${this.counts.error})`,
          });
        }

        setTimeout(() => {
          if (this.run === true) {
            if (timeout) {
              i -= 1;
              this.delay = 10000;
            } else {
              this.delay = 2000;
            }
            this.runHarvester(i);
          } else {
            this.stoppedAt = i;
          }
        }, this.delay);
      });
  }

  cancelJob() {
    this.stoppedAt = 0;
    this.run = false;
    document.getElementById("startButton").textContent = "start";
    this.cancelToken.cancel("Operation canceled due to reload");
    this.cancelToken = axios.CancelToken.source();
  }

  componentDidMount() {
    this.setState({
      candidates: this.props.candidates,
    });
    this.counts.total = this.props.candidates.length;
  }

  componentWillUnmount() {
    this.cancelJob();
    document.title = document.title.replace("DONE - ", "");
  }

  handleStartStop(event) {
    event.preventDefault();
    if (this.run === true) {
      event.target.textContent = "start";
      this.run = false;
      this.cancelToken.cancel("Operation canceled due to stop button");
      this.cancelToken = axios.CancelToken.source();
      this.setState({
        jobstatus: `stopped (${this.counts.success + this.counts.error}/${this.counts.total}, successes: ${this.counts.success}, errors: ${
          this.counts.error
        })`,
      });
    } else if (this.Jwt) {
      this.run = true;
      this.runHarvester(this.stoppedAt);
      event.target.textContent = "stop";
      this.setState({
        jobstatus: `doing... (${this.counts.success + this.counts.error}/${this.counts.total}, successes: ${this.counts.success}, errors: ${
          this.counts.error
        })`,
      });
    } else {
      toast.error(
        <span id="toast">
          you are not logged in.{" "}
          <button onClick={this.onLogin} className="linkButton">
            login
          </button>
        </span>,
        { position: toast.POSITION.TOP_CENTER }
      );
    }
  }

  convertArrayOfObjectsToCSV(array) {
    const columnDelimiter = ",";
    const lineDelimiter = "\n";
    const keys = ["pageid", "title", "qid", "rawvalue", "parsedvalue", "status", "message"];
    let result = "";
    result += keys.join(columnDelimiter);
    result += lineDelimiter;

    array.forEach(item => {
      let ctr = 0;
      keys.forEach(key => {
        if (ctr > 0) {
          result += columnDelimiter;
        }
        if (key in item) {
          if (String(item[key]).includes(columnDelimiter)) {
            result += `"${item[key]}"`;
          } else {
            result += item[key];
          }
        }
        ctr++;
      });
      result += lineDelimiter;
    });
    return result;
  }

  createLink() {
    let permalink = "";
    let exportParameters = [
      "siteid",
      "project",
      "namespace",
      "p",
      "template",
      "templateredirects",
      "parameters",
      "addprefix",
      "removeprefix",
      "addsuffix",
      "removesuffix",
      "searchvalue",
      "replacevalue",
      "category",
      "depth",
      "constraints",
      "alreadyset",
      "wikisyntax",
      "manuallist",
    ];
    if (this.props.job.datatype === "time") {
      exportParameters = [...exportParameters, "calendar", "limityear", "rel"];
    } else if (this.props.job.datatype === "quantity") {
      exportParameters = [...exportParameters, "unit", "decimalmark"];
    } else if (this.props.job.datatype === "monolingualtext") {
      exportParameters = [...exportParameters, "pagetitle", "monolanguage"];
    }
    for (let key of exportParameters) {
      if (key in this.props.job && this.props.job[key].toString().length > 0) {
        if (permalink !== "") {
          permalink += "&";
        }
        permalink += key + "=";
        if (Array.isArray(this.props.job[key])) {
          permalink += encodeURIComponent(this.props.job[key].join("|"));
        } else if (typeof this.props.job[key] === "boolean") {
          permalink += this.props.job[key] ? "1" : "0";
        } else {
          permalink += encodeURIComponent(this.props.job[key]);
        }
      }
    }
    return permalink;
  }

  handlePermalink() {
    let querystring = this.createLink();
    let permalink = "https://pltools.toolforge.org/harvesttemplates?" + querystring;
    window.open(permalink, "_blank");
  }

  handleSave() {
    let querystring = this.createLink();
    let savelink = "https://pltools.toolforge.org/harvesttemplates/share.php?action=savenew&" + querystring;
    window.open(savelink, "_blank");
  }

  handleDownload() {
    const link = document.createElement("a");
    let array = this.state.candidates ? this.state.candidates : [];
    let csv = this.convertArrayOfObjectsToCSV(array);
    if (csv == null) return;
    const filename = "export.csv";
    if (!csv.match(/^data:text\/csv/i)) {
      csv = `data:text/csv;charset=utf-8,${csv}`;
    }
    csv = csv.replace("#", "%23");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", filename);
    link.click();
  }

  onChangeRowsPerPage(e) {
    this.rowsPerPage = e;
  }

  render() {
    let columns = [
      {
        name: "Title",
        selector: "title",
        sortable: true,
        format: row => (
          <a href={`${this.props.job.site}/wiki/${row.title}`} target="_blank" rel="noopener noreferrer">
            {row.title}
          </a>
        ),
      },
      {
        name: "Wikidata item",
        selector: "qid",
        sortable: true,
        format: row => (
          <a href={`https://www.wikidata.org/wiki/${row.qid}`} target="_blank" rel="noopener noreferrer">
            {row.qid}
          </a>
        ),
      },
      {
        name: "raw value",
        selector: "rawvalue",
        sortable: true,
      },
      {
        name: "parsed value",
        selector: "parsedvalue",
        sortable: true,
      },
      {
        name: "message",
        selector: "message",
        sortable: true,
      },
    ];

    const conditionalRowStyles = [
      {
        when: row => row.message !== undefined,
        style: {
          backgroundColor: "#FF9E9B",
        },
      },
      {
        when: row => row.message === undefined,
        style: {
          backgroundColor: "#FADF63",
        },
      },
      {
        when: row => row.message === "success",
        style: {
          backgroundColor: "#7DCE82",
        },
      },
    ];

    let mytable = (
      <DataTable
        columns={columns}
        data={this.state.candidates ? this.state.candidates : []}
        pagination
        paginationPerPage={this.rowsPerPage}
        paginationRowsPerPageOptions={[10, 20, 50, 100, 500]}
        paginationDefaultPage={this.pageNo}
        onChangeRowsPerPage={e => (this.rowsPerPage = e)}
        keyField={"pageid"}
        conditionalRowStyles={conditionalRowStyles}
        noHeader
      />
    );
    return (
      <div className="fullwidth">
        <button onClick={this.handleStartStop} id="startButton" className="linkButton">
          start
        </button>
        <button onClick={this.handleDownload} className="linkButton">
          download log
        </button>
        <button onClick={this.handlePermalink} className="linkButton">
          permalink
        </button>
        <button onClick={this.handleSave} className="linkButton">
          publicly save
        </button>
        <div id="jobstatus">{this.state.jobstatus}</div>
        {mytable}
      </div>
    );
  }
}

export default Harvester;
