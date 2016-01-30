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
    return preg_replace('/{{(Q|P)\|(?:Q|P)?(\d+)}}/','$1$2',$text);
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
    $url.=$k.'='.$v2.'&';
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

$text = replaceQPtemplates($text);
$foo = replaceNowiki($text);
$text = $foo[0];
$templ = $foo[1];
$text = str_replace(array('|classes','| classes'),'|class',$text);

$con = array();

$constraints = array('Format' => array('pattern'),'Unique value'=> array(), 'Value type' => array('class','relation'), 'Type' => array('class','relation'), 'One of' => array('values'), 'Commons link' => array('namespace'), 'Conflicts with' => array('list'));


foreach($constraints as $constraint => $mparas){
    $pat = '/{{Constraint:'.$constraint.'\s*\|([^}]+)}}/';
    if ( preg_match_all( $pat, $text, $matches, PREG_SET_ORDER ) ){
        foreach($matches as $match){
            $ok = 1;
            $res = parseTemplate($match[1]);
            foreach($mparas as $mpara){
                if (!array_key_exists($mpara,$res)){
                    $ok = 0;
                }
            }
            if ($ok == 1){
                $newconstraint = array('type'=>$constraint);
                foreach($mparas as $mpara){
                    $value = $res[$mpara];
                    for ($i=0;$i<count($templ);$i++){
                        $value = str_replace('$$$'.($i+1),$templ[$i],$value);
                    }
                    if ($mpara == 'class' OR $mpara == 'values'){
                        $value = parseQ($value);
                    }
                    if ($mpara == 'list'){
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
