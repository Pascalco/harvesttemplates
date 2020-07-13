<?php
include('../connect.inc.php');

$context = stream_context_create(
    array(
        "http" => array(
            "header" => "User-Agent: PLtools"
        )
    )
);

$username = '';
if (isset($_COOKIE['plnodeJwt'])){
    $url = "https://plnode.toolforge.org/profile?token=".$_COOKIE['plnodeJwt'];
    $response = file_get_contents($url, false, $context);
    if ($response !== False){
        $ret = json_decode($response);
        $username = $ret->username;
    }
}
if (isset($_GET['action']) and $username != ''){
    if ($_GET['action'] == 'savenew'){
        mysqli_query($conn2, 'INSERT INTO ht_share (para, user) VALUES ("'.$_SERVER["QUERY_STRING"].'", "'.$username.'")');
    } else if ($_GET['action'] == 'delete'){
        mysqli_query($conn2, 'DELETE FROM ht_share WHERE id = "'.$_GET['id'].'" AND user = "'.$username.'"');
        return 1;
    } else if ($_GET['action'] == 'update' and isset($_GET['htid'])){
        mysqli_query($conn2, 'UPDATE ht_share SET lastrun = now() WHERE id = "'.$_GET['htid'].'"');
        return 1;
    }
}

function apiRequest(array $args) {
	$url = "https://www.wikidata.org/w/api.php?".http_build_query($args);
	$response = file_get_contents($url, false, $context);
	$ret = json_decode($response);
	if ($ret === null) {
		echo 'Unparsable API response: <pre>' . htmlspecialchars( $ret ) . '</pre>';
		exit(0);
	}
	return $ret;
}

function createContent(){
    global $conn2;
    global $username;
    $content = '';
    $result = mysqli_query($conn2, 'SELECT id, para, user, lastrun FROM ht_share');
    while ($row = mysqli_fetch_assoc($result)){
        parse_str($row['para'], $para);
        $content .= sprintf('<tr data-id="%d"><td>%s.%s<br /><small>NS: %d</small><td><a href="//www.wikidata.org/wiki/Property:%s">%5$s</a></td><td><a href="//%2$s.%3$s.org/wiki/Template:%6$s">%6$s</a></td>', $row['id'], $para['siteid'], $para['project'], $para['namespace'], $para['p'], $para['template']);
        if (array_key_exists('aparameter1', $para) and !empty($para['aparameter1'])){
            $content .= sprintf('<td>year: %s<br />month: %s<br />day: %s</td>', $para['aparameter1'], $para['aparameter2'], $para['aparameter3']);
        } else if (is_array($para['paramters'])){
            $content .= sprintf('<td>%s</td>', implode('<br /><b>or</b> ', $para['parameter']));
        } else {
            $content .= sprintf('<td>%s</td>', $para['parameters']);
        }
        $additional = ['wikisyntax', 'prefix', 'calendar', 'rel', 'limityear', 'unit', 'decimalmark', 'manuallist', 'set', 'addprefix', 'removeprefix', 'addsuffix', 'removesuffix', 'searchvalue', 'replacevalue', 'category', 'depth'];
        $content .= '<td>';
        foreach($additional as $ad){
            if (array_key_exists($ad, $para)){
                $content .= sprintf('<i>%s</i>: %s<br />', $ad, $para[$ad]);
            }
        }
        $content .= sprintf('<td><a href="//www.wikidata.org/wiki/User:%1$s">%1$s</a></td><td>%2$s</td>', $row['user'], $row['lastrun']);
        $content .= sprintf('<td><a href="index.html?htid=%1$s" target="_blank" class="button1">load</a></td>', $row['id']);
        if ($row['user'] == $username){
            $content .= '<td><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/OOjs_UI_icon_trash-destructive.svg/24px-OOjs_UI_icon_trash-destructive.svg.png" width="24" alt="delete" class="delete" /></td>';
        } else {
            $content .= '<td></td>';
        }
        $content .= '</tr>';
    }
    return $content;
}
?>
<!doctype html>
<!--
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
//-->
<html>

<head>
    <title>PLtools: Harvest Templates Share</title>
    <meta charset="utf-8">

    <link href="share.css" rel="stylesheet">
    <link href="../common.css" rel="stylesheet">

    <script src="//tools-static.wmflabs.org/static/jquery/1.11.0/jquery.min.js"></script>
    <script src="tablesorter.js"></script>
    <script src="share.js"></script>

</head>

<body>

    <div id="headline"><a href="//pltools.toolforge.org" target="_blank">PLtools</a>: Harvest Templates Share</div>

    <div id="main">

    <table id="maintable">
    <thead><tr><th>project</th><th>property</th><th>template</th><th>parameter</th><th>additional parameters</th><th>created by</th><th>last run</th><th>run</th><th></th></tr></thead>
    <tbody>
    <?php
        echo createContent();
    ?>
    </tbody>
    </table>
    </div>

</body>

</html>
