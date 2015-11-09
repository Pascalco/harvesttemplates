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

$con = array();

if ( strpos( $text, '{{Constraint:Format|pattern=' ) !== false ){
    $foo = explode( '{{Constraint:Format|pattern=<nowiki>', $text );
    if ( count( $foo ) > 1){
        $foo2 = explode( '</nowiki>', $foo[1] );
    } else {
        $foo = explode( '{{Constraint:Format|pattern=', $text );
        $foo2 = explode('}}', $foo[1] );
    }
    if (substr($foo2[0],0,4) == '(?i)'){
        $con['format'] = array( 'pattern' => substr($foo2[0],4), 'modifier' => 'i' );
    } else {
        $con['format'] = array( 'pattern' => $foo2[0], 'modifier' => '' );
    }
}
echo json_encode( $con );
?>
