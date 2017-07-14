<?php
/**
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
**/

header('Content-Type: application/json');

function parseQ($str){
    $res = explode( ',', $str );
    return array_map( 'trim', $res );
}

function parsePQ($str){
    $res = array();
    $fields = explode( ';', $str);
    foreach($fields as $field){
        $co = explode( ':', $field);
        if (count($co) == 1){
            $res[trim($co[0])] = array();
        } else {
            $res[trim($co[0])] = parseQ($co[1]);
        }
    }
    return $res;
}

function replaceQPtemplates($text){
    return preg_replace('/{{(P|Q)\|(?:P|Q)?(\d+)}}/','$1$2',$text);
}

function replaceQlinks($text){
    return preg_replace('/\[\[(Q\d+)\]\]/','$1',$text);
}

function replaceNowiki($text){
    $templ = array();
    $fields = explode('<nowiki>',$text);
    $newtext = $fields[0];
    for($i=1;$i<count($fields);$i++){
        $para = explode('</nowiki>',$fields[$i]);
        array_push($templ,$para[0]);
        $newtext .= '$$$'.$i;
        $newtext .= isset($para[1]) ? $para[1] : '';
    }
    return array($newtext,$templ);
}

function parseTemplate($text){
    $res = array();
    $fields = explode('|',$text);
    foreach($fields as $field){
        $para = explode('=',$field);
        $res[trim($para[0])] = trim($para[1]);
    }
    return $res;
}

$url = 'https://www.wikidata.org/w/api.php?';
$data = array('action' => 'query', 'titles' => 'Property_talk:'.$_GET['p'], 'prop' => 'revisions', 'rvprop' => 'content', 'format' => 'json');
foreach( $data as $k => $v ){
    $v2 = str_replace( ' ', '%20', $v );
    $url .= "$k=$v2&";
}
$curl = curl_init();
curl_setopt_array( $curl, array(
    CURLOPT_RETURNTRANSFER => 1,
    CURLOPT_URL => $url
));
$query = json_decode( curl_exec( $curl ) );
curl_close( $curl );

foreach( $query->query->pages as $k => $v ){
    $text = $v->revisions[0]->{'*'};
}

# $text = preg_replace('/<!--.*?-->/s', '', $text);
$text = replaceQPtemplates($text);
$text = replaceQlinks($text);
list( $text, $templ ) = replaceNowiki($text);
$text = str_replace(array('|classes','| classes'),'|class',$text);

$con = array();

$constraints = array(
    'Qualifier' => array(),
    'Qualifiers' => array('list', 'required'),
    'Source' => array(),
    'Format' => array('pattern'),
    'Unique value'=> array(),
    'Value type' => array('class','relation'),
    'Type' => array('class','relation'),
    'One of' => array('values'),
    'Commons link' => array('namespace'),
    'Conflicts with' => array('list'),
    'Range' => array('min','max')
);

foreach($constraints as $constraint => $mparas){
    $pat = '/{{[Cc]onstraint:' . str_replace( ' ', '[ _]', $constraint ) . '\s*(?:\|([^}]+))?}}/';
    if ( preg_match_all( $pat, $text, $matches, PREG_SET_ORDER ) ){
        $newconstraint = array( 'type' => $constraint );
        if ( in_array( $constraint, array( 'Qualifier', 'Source' ) ) ) {
            $con = array( $newconstraint );
            break;
        }
        foreach($matches as $match){
            $ok = 1;
            $res = isset( $match[1] ) ? parseTemplate($match[1]) : array();
            foreach($mparas as $mpara){
                if (!array_key_exists($mpara,$res)){
                    $ok = 0;
                    break;
                }
            }
            if ($ok == 1){
                foreach($mparas as $mpara){
                    $value = $res[$mpara];
                    for ($i=count($templ)-1;$i>=0;$i--){
                        $value = str_replace('$$$'.($i+1),$templ[$i],$value);
                    }
                    if ($mpara == 'class' || $mpara == 'values'){
                        $value = parseQ($value);
                    }
                    if ($mpara == 'list' && $constraint == 'Conflicts with' ) {
                        $value = parsePQ($value);
                    }
                    if ($mpara == 'pattern'){
                        if (substr($value,0,4) == '(?i)'){
                            $newconstraint['modifier'] = 'i';
                            $value = substr($value,4);
                        }
                    }
                    $newconstraint[$mpara] = $value;
                }
                array_push($con, $newconstraint);
            }
        }
    }
}

echo json_encode( $con );
?>
