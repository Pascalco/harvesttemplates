<?php
include('../connect.inc.php');
include('../oauth.php');
$userinfo = json_decode(getUserInfo());
$username = $userinfo->query->userinfo->name;
if (isset($_GET['action'])){
    if ($_GET['action'] == 'savenew'){
        mysqli_query($conn2, 'INSERT INTO ht_share (para, user) VALUES ("'.$_SERVER["QUERY_STRING"].'", "'.$username.'")');
    } else if ($_GET['action'] == 'delete'){
        mysqli_query($conn2, 'DELETE FROM ht_share WHERE id = "'.$_GET['id'].'" AND user = "'.$username.'"');
        return 0;
    } else if ($_GET['action'] == 'edit'){
        mysqli_query($conn2, 'UPDATE ht_share SET tags = "'.$_GET['tags'].'" WHERE id = "'.$_GET['id'].'" AND user = "'.$username.'"');
        return 0;
    }
}

function apiRequest(array $args) {
	$url = "https://www.wikidata.org/w/api.php?".http_build_query($args);
	$response = file_get_contents($url);
	$ret = json_decode($response);
	if ($ret === null) {
		echo 'Unparsable API response: <pre>' . htmlspecialchars( $ret ) . '</pre>';
		exit(0);
	}
	return $ret;
}

function getLabel($id){
	$req = apiRequest( array( 'format'=>'json','action'=>'wbgetentities','ids'=>$id,'props'=>'labels','languages'=>'en','languagefallback'=>'1' ) );
	return $req->entities->$id->labels->en->value;
}

function createContent(){
    global $conn2;
    global $username;
    $content = '';
    $result = mysqli_query($conn2, 'SELECT id, para, user, lastrun, tags FROM ht_share');
    while ($row = mysqli_fetch_assoc($result)){
        parse_str($row['para'], $para);
        $content .= sprintf('<tr data-id="%d"><td>%s.%s<br /><small>NS: %d</small><td><a href="//www.wikidata.org/wiki/Property:P%d">%s (P%5$d)</a></td><td><a href="//%2$s.%3$s.org/wiki/Template:%7$s">%7$s</a></td>', $row['id'], $para['siteid'], $para['project'], $para['namespace'], $para['property'], getLabel('P'.$para['property']), $para['template']);
        if (array_key_exists('aparameter1', $para) and !empty($para['aparameter1'])){
            $content .= sprintf('<td>year: %s<br />month: %s<br />day: %s</td>', $para['aparameter1'], $para['aparameter2'], $para['aparameter3']);
        } else if (is_array($para['paramter'])){
            $content .= sprintf('<td>%s</td>', implode('<br /><b>or</b> ', $para['parameter']));
        } else {
            $content .= sprintf('<td>%s</td>', $para['parameter']);
        }
        $additional = ['wikisyntax', 'prefix', 'calendar', 'rel', 'limityear', 'unit', 'decimalmark', 'manuallist', 'set', 'offset', 'limit'];
        $content .= '<td>';
        foreach($additional as $ad){
            if (array_key_exists($ad, $para)){
                $content .= sprintf('<i>%s</i>: %s<br />', $ad, $para[$ad]);
            }
        }
        $content .= sprintf('<td><a href="//www.wikidata.org/wiki/User:%1$s">%1$s</a></td><td>%2$s<td><span class="tags">%3$s</span>', $row['user'], $row['lastrun'], $row['tags']);
        if ($row['user'] == $username){
            $content .= '<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/OOjs_UI_icon_edit-ltr.svg/24px-OOjs_UI_icon_edit-ltr.svg.png" width="24" alt="edit" class="edit" />';
        }
        $content .= '</td>';
        $content .= sprintf('<td><a href="index.php?htid=%1$s&load=1" target="_blank" class="button1">load</a><br /><a href="index.php?htid=%1$s&run=1" target="_blank" class="button1">load and run</a></td>', $row['id']);
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

    <?php
        $commit = trim(file_get_contents( '../harvesttemplates/.git/refs/heads/master' ));
    ?>
    <script src="share.js?version=<?php echo $commit; ?>"></script>
    <script src="../common.js"></script>

</head>

<body>

    <div id="headline"><a href="//tools.wmflabs.org/pltools" target="_blank">PLtools</a>: Harvest Templates Share | <a href="https://github.com/Pascalco/harvesttemplates" target="_blank">source</a> | </div>

    <div id="main">

    <table id="maintable">
    <tr><th>project</th><th>property</th><th>template</th><th>parameter</th><th>additional parameters</th><th>created by</th><th>last run</th><th>tags</th><th>run</th><th></th></tr>

    <?php
        echo createContent();
    ?>
    </table>
    </div>

</body>

</html>
