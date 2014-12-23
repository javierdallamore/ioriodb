-module(iorio_user).
-export([create/2, users/0, user_grants/0, grants_for/2]).

create(Username, Password) when is_binary(Username) ->
    create(binary_to_list(Username), Password);

create(Username, Password) when is_binary(Password) ->
    create(Username, binary_to_list(Password));

create(Username, Password) ->
    case riak_core_security:add_user(Username, [{"password", Password}]) of
        ok ->
            riak_core_security:add_source([Username], {{127, 0, 0, 1}, 32}, password, []);
        Error ->
            Error
    end.


users() ->
    % NOTE '$deleted' is copied here since the other is a constant on
    % riak_core_security ?TOMBSTONE
    riak_core_metadata:fold(fun({_Username, ['$deleted']}, Acc) ->
                                    Acc;
                               ({Username, Options}, Acc) ->
                                    [{Username, Options}|Acc]
                            end, [], {<<"security">>, <<"users">>}).

user_grants() ->
    riak_core_metadata:fold(fun({{Username, {Bucket, Stream}}, [Perms]}, Acc) ->
                                    [{Username, Bucket, Stream, Perms}|Acc];
                               ({{Username, Bucket}, [Perms]}, Acc) ->
                                    [{Username, Bucket, any, Perms}|Acc]
                            end, [], {<<"security">>, <<"usergrants">>}).

grants_for(QBucket, any) ->
    riak_core_metadata:fold(fun({{Username, Bucket}, [Perms]}, Acc) when QBucket =:= Bucket ->
                                    [{Username, Bucket, any, Perms}|Acc];
                               (_, Acc) -> Acc
                            end, [], {<<"security">>, <<"usergrants">>});
grants_for(QBucket, QStream) ->
    riak_core_metadata:fold(fun({{Username, {Bucket, Stream}}, [Perms]}, Acc) 
                                  when QBucket =:= Bucket andalso QStream =:= Stream ->
                                    [{Username, Bucket, Stream, Perms}|Acc];
                               (_, Acc) -> Acc
                            end, [], {<<"security">>, <<"usergrants">>}).
